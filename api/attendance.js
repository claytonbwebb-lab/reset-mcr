import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = 'hello@resetmcr.com';

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { booking_id, status, cancellation_reason } = req.body;

    if (!booking_id || !status) {
      return res.status(400).json({ error: 'booking_id and status are required' });
    }

    if (!['attended', 'no_show', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Get booking with customer
    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select(`
        id, start_datetime, status,
        customer:customer_id(id, name, email, consecutive_no_shows),
        staff:staff_id(name),
        service:service_id(name)
      `)
      .eq('id', booking_id)
      .single();

    if (fetchErr || !booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Update booking status
    const { error: updateErr } = await supabase
      .from('bookings')
      .update({
        status,
        cancellation_reason: cancellation_reason || null
      })
      .eq('id', booking_id);

    if (updateErr) throw updateErr;

    // Update customer no-show tracking
    if (booking.customer) {
      if (status === 'no_show') {
        const newCount = (booking.customer.consecutive_no_shows || 0) + 1;
        const isBlocked = newCount >= 3;
        await supabase
          .from('customers')
          .update({
            consecutive_no_shows: newCount,
            is_blocked: isBlocked,
            no_show_count: (booking.customer.no_show_count || 0) + 1
          })
          .eq('id', booking.customer.id);
      } else if (status === 'attended') {
        await supabase
          .from('customers')
          .update({ consecutive_no_shows: 0 })
          .eq('id', booking.customer.id);
      }
    }

    // Send cancellation email if cancelled
    if (status === 'cancelled' && booking.customer) {
      const cancelLink = `https://resetmcr.com/?cancel=${booking.id}&email=${encodeURIComponent(booking.customer.email)}`;
      await resend.emails.send({
        from: FROM_EMAIL,
        to: booking.customer.email,
        subject: 'Booking cancelled — Reset MCR',
        html: `
          <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;color:#f7f3ec;background:#050505;padding:40px;border-radius:24px;">
            <h1 style="font-family:Oswald,sans-serif;text-transform:uppercase;font-size:28px;color:#e3c89c;text-align:center;margin:0 0 24px;">Booking Cancelled</h1>
            <p style="text-align:center;color:#b6ada0;margin:0 0 32px;">Your appointment on ${formatDate(booking.start_datetime)} at ${formatTime(booking.start_datetime)} has been cancelled.</p>
            ${cancellation_reason ? `<p style="color:#b6ada0;font-size:14px;text-align:center;"><em>"${cancellation_reason}"</em></p>` : ''}
            <p style="text-align:center;margin-top:28px;">
              <a href="https://resetmcr.com/#book" style="background:linear-gradient(135deg,#e3c89c,#b89b75);color:#060606;padding:14px 24px;border-radius:999px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;text-decoration:none;">Book a new appointment</a>
            </p>
          </div>
        `
      }).catch(e => console.error('Cancellation email failed:', e.message));
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Attendance error:', error);
    return res.status(500).json({ error: 'Failed to update attendance' });
  }
}
