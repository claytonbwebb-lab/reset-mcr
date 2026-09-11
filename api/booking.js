import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { ukLocalToUtcIso } from './_ukTime.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'Reset MCR <noreply@playpredictwin.com>';
const JACK_EMAIL = process.env.EMAIL_TO || 'hello@resetmcr.com';

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Europe/London'
  });
}
function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'Europe/London'
  });
}

async function sendCustomerConfirmation(booking, customer, service, staffMember) {
  const cancelLink = `https://resetmcr.com/?cancel=${booking.id}&email=${encodeURIComponent(customer.email)}`;
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: customer.email,
      subject: `Your booking at Reset MCR — ${formatDate(booking.start_datetime)}`,
      html: `
        <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;color:#f7f3ec;background:#050505;padding:40px;border-radius:24px;">
          <div style="text-align:center;margin-bottom:32px;">
            <img src="https://resetmcr.com/assets/reset-mcr-logo.png" alt="RESET MCR" style="width:60px;height:60px;border-radius:12px;object-fit:contain;" />
          </div>
          <h1 style="font-family:Oswald,sans-serif;text-transform:uppercase;font-size:32px;text-align:center;color:#e3c89c;margin:0 0 8px;">Booking Confirmed</h1>
          <p style="text-align:center;color:#b6ada0;margin:0 0 32px;">Thanks ${customer.name}, your appointment is set.</p>
          <div style="background:#0b0b0b;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:28px;margin-bottom:24px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="color:#b6ada0;font-size:13px;padding:6px 0;">Service</td><td style="text-align:right;color:#f7f3ec;font-weight:700;padding:6px 0;">${service.name}</td></tr>
              <tr><td style="color:#b6ada0;font-size:13px;padding:6px 0;">Barber</td><td style="text-align:right;color:#f7f3ec;font-weight:700;padding:6px 0;">${staffMember.name}</td></tr>
              <tr><td style="color:#b6ada0;font-size:13px;padding:6px 0;">Date</td><td style="text-align:right;color:#f7f3ec;font-weight:700;padding:6px 0;">${formatDate(booking.start_datetime)}</td></tr>
              <tr><td style="color:#b6ada0;font-size:13px;padding:6px 0;">Time</td><td style="text-align:right;color:#f7f3ec;font-weight:700;padding:6px 0;">${formatTime(booking.start_datetime)}</td></tr>
              <tr><td style="color:#b6ada0;font-size:13px;padding:6px 0;">Location</td><td style="text-align:right;color:#f7f3ec;font-weight:700;padding:6px 0;">Under the railway arches, Stalybridge</td></tr>
            </table>
          </div>
          <p style="text-align:center;font-size:14px;color:#b6ada0;margin-bottom:20px;">
            Need to change your booking?<br/>
            <a href="${cancelLink}" style="color:#e3c89c;">Cancel or reschedule online</a><br/>
            <small>Changes close 30 mins before your appointment</small>
          </p>
          <p style="text-align:center;color:#b6ada0;font-size:12px;margin:0;">See you at Reset MCR — under the railway arches, Stalybridge</p>
        </div>
      `
    });
  } catch (e) {
    console.error('Customer email failed:', e.message);
  }
}

async function sendJackNotification(booking, customer, service, staffMember) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: JACK_EMAIL,
      subject: `New booking — ${service.name} with ${customer.name}`,
      html: `
        <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;color:#f7f3ec;background:#050505;padding:40px;border-radius:24px;">
          <h1 style="font-family:Oswald,sans-serif;text-transform:uppercase;font-size:28px;color:#e3c89c;margin:0 0 24px;">New Booking</h1>
          <div style="background:#0b0b0b;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:28px;margin-bottom:24px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="color:#b6ada0;font-size:13px;padding:6px 0;">Customer</td><td style="text-align:right;color:#f7f3ec;font-weight:700;padding:6px 0;">${customer.name}</td></tr>
              <tr><td style="color:#b6ada0;font-size:13px;padding:6px 0;">Email</td><td style="text-align:right;color:#f7f3ec;padding:6px 0;">${customer.email}</td></tr>
              <tr><td style="color:#b6ada0;font-size:13px;padding:6px 0;">Mobile</td><td style="text-align:right;color:#f7f3ec;padding:6px 0;">${customer.mobile || '—'}</td></tr>
              <tr><td style="color:#b6ada0;font-size:13px;padding:6px 0;">Service</td><td style="text-align:right;color:#f7f3ec;font-weight:700;padding:6px 0;">${service.name}</td></tr>
              <tr><td style="color:#b6ada0;font-size:13px;padding:6px 0;">Barber</td><td style="text-align:right;color:#f7f3ec;font-weight:700;padding:6px 0;">${staffMember.name}</td></tr>
              <tr><td style="color:#b6ada0;font-size:13px;padding:6px 0;">Date</td><td style="text-align:right;color:#f7f3ec;font-weight:700;padding:6px 0;">${formatDate(booking.start_datetime)}</td></tr>
              <tr><td style="color:#b6ada0;font-size:13px;padding:6px 0;">Time</td><td style="text-align:right;color:#f7f3ec;font-weight:700;padding:6px 0;">${formatTime(booking.start_datetime)}</td></tr>
              <tr><td style="color:#b6ada0;font-size:13px;padding:6px 0;">Source</td><td style="text-align:right;color:#f7f3ec;padding:6px 0;">${booking.source}</td></tr>
              <tr><td style="color:#b6ada0;font-size:13px;padding:6px 0;">Recurring</td><td style="text-align:right;color:#f7f3ec;padding:6px 0;">${booking.is_recurring ? booking.recurring_interval : 'No'}</td></tr>
            </table>
          </div>
        </div>
      `
    });
  } catch (e) {
    console.error('Jack notification failed:', e.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { service_id, staff_id, start_datetime, customer_name, customer_email, customer_mobile, is_recurring, recurring_interval, validate_only } = req.body;

    if (!service_id || !staff_id || !start_datetime || !customer_name || !customer_email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let resolvedStaffId = staff_id;
    if (staff_id === 'any') {
      const { data: availableStaff } = await supabase
        .from('staff')
        .select('id')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1);
      if (!availableStaff || availableStaff.length === 0) {
        return res.status(400).json({ error: 'No barbers currently available. Please try again later.' });
      }
      resolvedStaffId = availableStaff[0].id;
    }

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .upsert({ name: customer_name, email: customer_email, mobile: customer_mobile || null }, { onConflict: 'email' })
      .select()
      .single();

    if (customerError) throw customerError;

    if (customer.is_blocked) {
      return res.status(403).json({ error: 'Online booking unavailable — please contact Reset MCR directly to reset this.' });
    }

    const { data: durationRow, error: durErr } = await supabase
      .from('staff_service_durations')
      .select('duration_mins')
      .eq('staff_id', resolvedStaffId)
      .eq('service_id', service_id)
      .single();

    if (durErr || !durationRow) {
      return res.status(400).json({ error: 'Invalid service or staff selection' });
    }

    const durationMins = durationRow.duration_mins;
    const startDate = new Date(ukLocalToUtcIso(start_datetime));
    const endDate = new Date(startDate.getTime() + durationMins * 60000);

    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('staff_id', resolvedStaffId)
      .neq('status', 'cancelled')
      .lt('start_datetime', endDate.toISOString())
      .gt('end_datetime', startDate.toISOString())
      .limit(1)
      .maybeSingle();

    if (existingBooking) {
      return res.status(409).json({ error: 'This slot is already booked. Please go back and choose another time.' });
    }

    if (validate_only) {
      return res.status(200).json({ ok: true });
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        customer_id: customer.id,
        staff_id: resolvedStaffId,
        service_id,
        start_datetime: startDate.toISOString(),
        end_datetime: endDate.toISOString(),
        status: 'confirmed',
        is_recurring: is_recurring || false,
        recurring_interval: recurring_interval || null,
        source: 'online'
      })
      .select()
      .single();

    if (bookingError) throw bookingError;

    const { data: service } = await supabase.from('services').select('name').eq('id', service_id).single();
    const { data: staffMember } = await supabase.from('staff').select('name').eq('id', resolvedStaffId).single();

    await Promise.all([
      sendCustomerConfirmation(booking, customer, service, staffMember),
      sendJackNotification(booking, customer, service, staffMember)
    ]);

    if (is_recurring && recurring_interval) {
      const intervalDays = recurring_interval === 'weekly' ? 7 : recurring_interval === 'fortnightly' ? 14 : 30;
      const nextStart = new Date(startDate.getTime() + intervalDays * 86400000);
      if (nextStart <= new Date(Date.now() + 28 * 86400000)) {
        const nextEnd = new Date(nextStart.getTime() + durationMins * 60000);
        await supabase.from('bookings').insert({
          customer_id: customer.id,
          staff_id: resolvedStaffId,
          service_id,
          start_datetime: nextStart.toISOString(),
          end_datetime: nextEnd.toISOString(),
          status: 'confirmed',
          is_recurring: false,
          source: 'online'
        });
      }
    }

    return res.status(200).json({ booking_id: booking.id, success: true });
  } catch (error) {
    console.error('Booking error:', error);
    return res.status(500).json({ error: 'Failed to create booking' });
  }
}
