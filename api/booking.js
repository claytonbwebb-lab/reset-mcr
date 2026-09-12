import { createClient } from '@supabase/supabase-js';
import { ukLocalToUtcIso } from './_ukTime.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VPS_EMAIL_URL = 'http://13.49.47.171/api/resetmcr/booking-email';

// All datetimes are stored and received as UTC ISO strings.
// Formatting converts to UK local time for display.
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

async function sendEmailsViaVps(booking, customer, service, staffMember) {
  const cancelLink = `https://resetmcr.com/?cancel=${booking.id}&email=${encodeURIComponent(customer.email)}`;
  try {
    await fetch(VPS_EMAIL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerEmail: customer.email,
        customerName: customer.name,
        barberName: staffMember.name,
        serviceName: service.name,
        date: formatDate(booking.start_datetime),
        time: formatTime(booking.start_datetime),
        cancelLink,
        adminEmails: ['hello@resetmcr.com']
      })
    });
  } catch (e) {
    console.error('Email proxy failed:', e.message);
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

    // Send emails via VPS Zoho proxy (fire and forget — don't fail booking if email fails)
    sendEmailsViaVps(booking, customer, service, staffMember);

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
