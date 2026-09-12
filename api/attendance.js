import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VPS_EMAIL_URL = 'http://13.49.47.171/api/resetmcr/attendance-email';

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
      try {
        await fetch(VPS_EMAIL_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerEmail: booking.customer.email,
            customerName: booking.customer.name,
            date: formatDate(booking.start_datetime),
            time: formatTime(booking.start_datetime),
            status: 'cancelled',
            cancellationReason: cancellation_reason || null
          })
        });
      } catch (e) {
        console.error('Cancellation email proxy failed:', e.message);
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Attendance error:', error);
    return res.status(500).json({ error: 'Failed to update attendance' });
  }
}
