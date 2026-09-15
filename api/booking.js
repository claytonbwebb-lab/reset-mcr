import { createClient } from '@supabase/supabase-js';
import { ukLocalToUtcIso } from './_ukTime.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VPS_EMAIL_URL = 'http://13.49.47.171/api/resetmcr/booking-email';

// ── Constants ───────────────────────────────────────────────────────────────
const INTERVAL_DAYS = {
  weekly: 7,
  fortnightly: 14,
  '3weekly': 21,
  monthly: 30  // Approx 4 weeks
};
const MAX_ADVANCE_DAYS = 28; // Customer bookings: max 4 weeks ahead
const PREBOOK_AHEAD_DAYS = 28; // How far to pre-book recurring appointments

// Formatting helpers
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

// ── Email helpers ───────────────────────────────────────────────────────────
async function sendEmailsViaVps(booking, customer, service, staffMember, seriesInfo = null) {
  const cancelLink = `https://resetmcr.com/?cancel=${booking.id}&email=${encodeURIComponent(customer.email)}`;
  const extra = seriesInfo ? `\nThis is part of a ${seriesInfo.interval} series.` : '';
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
        adminEmails: [process.env.JACK_EMAIL || 'jack@resetmcr.com'],
        extraNote: extra
      })
    });
  } catch (e) {
    console.error('Email proxy failed:', e.message);
  }
}

// ── Slot finding for recurring bookings ─────────────────────────────────────
// Find the best available slot on targetDate, preferring same time/staff with fallback
async function findRecurringSlot(supabase, series, targetDate, durationMins, preferredStaffId) {
  const { preferred_time, preferred_day_of_week } = series;
  const dow = targetDate.getDay();

  // If day-of-week mismatch, skip (shouldn't happen but safety)
  if (dow !== preferred_day_of_week) {
    return null;
  }

  const dateStr = targetDate.toISOString().split('T')[0];
  const startTimeStr = preferred_time;

  // Helper to check if a slot is free
  async function isSlotFree(staffId, timeStr) {
    const startIso = new Date(`${dateStr}T${timeStr}:00`).toISOString();
    const endIso = new Date(new Date(`${dateStr}T${timeStr}:00`).getTime() + durationMins * 60000).toISOString();

    // Check staff availability for this day
    const { data: avail } = await supabase
      .from('staff_availability')
      .select('start_time, end_time, break_start, break_end')
      .eq('staff_id', staffId)
      .eq('day_of_week', dow)
      .single();
    if (!avail) return false;

    // Check bounds
    const slotStartMins = parseInt(timeStr.split(':')[0]) * 60 + parseInt(timeStr.split(':')[1]);
    const dur = durationMins;
    const slotEndMins = slotStartMins + dur;
    const workStart = parseInt(avail.start_time.split(':')[0]) * 60 + parseInt(avail.start_time.split(':')[1]);
    const workEnd = parseInt(avail.end_time.split(':')[0]) * 60 + parseInt(avail.end_time.split(':')[1]);

    if (slotStartMins < workStart || slotEndMins > workEnd) return false;

    // Check break
    if (avail.break_start && avail.break_end) {
      const breakStartMins = parseInt(avail.break_start.split(':')[0]) * 60 + parseInt(avail.break_start.split(':')[1]);
      const breakEndMins = parseInt(avail.break_end.split(':')[0]) * 60 + parseInt(avail.break_end.split(':')[1]);
      if (slotStartMins < breakEndMins && slotEndMins > breakStartMins) return false;
    }

    // Check unavailable
    const { data: unavail } = await supabase
      .from('staff_unavailable')
      .select('start_datetime, end_datetime')
      .eq('staff_id', staffId)
      .lte('start_datetime', `${dateStr}T23:59:59`)
      .gte('end_datetime', `${dateStr}T00:00:00`);

    for (const u of unavail || []) {
      const uStart = new Date(u.start_datetime);
      const uEnd = new Date(u.end_datetime);
      const s = new Date(startIso);
      const e = new Date(endIso);
      if (s < uEnd && e > uStart) return false;
    }

    // Check existing bookings
    const { data: existing } = await supabase
      .from('bookings')
      .select('id')
      .eq('staff_id', staffId)
      .neq('status', 'cancelled')
      .lt('start_datetime', endIso)
      .gt('end_datetime', startIso)
      .limit(1)
      .maybeSingle();

    return !existing;
  }

  // 1. Try preferred time with preferred staff
  if (preferredStaffId && await isSlotFree(preferredStaffId, startTimeStr)) {
    return { staff_id: preferredStaffId, time: startTimeStr };
  }

  // 2. Try preferred time with ANY available staff (same barber concept — any available)
  const { data: activeStaff } = await supabase.from('staff').select('id, name, created_at').eq('is_active', true).order('created_at');
  for (const s of activeStaff || []) {
    if (s.id === preferredStaffId) continue; // Already checked above
    if (await isSlotFree(s.id, startTimeStr)) {
      return { staff_id: s.id, time: startTimeStr };
    }
  }

  // 3. Try ±30min with preferred staff
  if (preferredStaffId) {
    for (const offset of [-30, 30, -60, 60, -90, 90]) {
      const tMins = parseInt(startTimeStr.split(':')[0]) * 60 + parseInt(startTimeStr.split(':')[1]) + offset;
      if (tMins < 0 || tMins > 1440) continue;
      const tStr = `${String(Math.floor(tMins / 60)).padStart(2, '0')}:${String(tMins % 60).padStart(2, '0')}`;
      if (await isSlotFree(preferredStaffId, tStr)) {
        return { staff_id: preferredStaffId, time: tStr };
      }
    }
  }

  // 4. Try ±30min with any available staff
  for (const s of activeStaff || []) {
    if (s.id === preferredStaffId) continue;
    for (const offset of [-30, 30, -60, 60, -90, 90]) {
      const tMins = parseInt(startTimeStr.split(':')[0]) * 60 + parseInt(startTimeStr.split(':')[1]) + offset;
      if (tMins < 0 || tMins > 1440) continue;
      const tStr = `${String(Math.floor(tMins / 60)).padStart(2, '0')}:${String(tMins % 60).padStart(2, '0')}`;
      if (await isSlotFree(s.id, tStr)) {
        return { staff_id: s.id, time: tStr };
      }
    }
  }

  return null; // No slot found
}

// ── Generate all future bookings for a series ───────────────────────────────
async function generateSeriesBookings(supabase, series, startFrom = null) {
  const { id: seriesId, customer_id, service_id, preferred_staff_id, interval, preferred_time } = series;
  const days = INTERVAL_DAYS[interval];

  // Get service duration
  const { data: durRow } = await supabase
    .from('staff_service_durations')
    .select('duration_mins')
    .eq('staff_id', preferred_staff_id)
    .eq('service_id', service_id)
    .single();
  const durationMins = durRow?.duration_mins || 30;

  // Find latest booked appointment in this series
  const { data: latest } = await supabase
    .from('bookings')
    .select('start_datetime')
    .eq('recurring_series_id', seriesId)
    .neq('status', 'cancelled')
    .order('start_datetime', { ascending: false })
    .limit(1)
    .single();

  let cursor = latest ? new Date(latest.start_datetime) : (startFrom ? new Date(startFrom) : null);
  if (!cursor) return [];

  const horizon = new Date(Date.now() + PREBOOK_AHEAD_DAYS * 86400000);
  const bookings = [];

  while (cursor <= horizon) {
    cursor = new Date(cursor.getTime() + days * 86400000);
    if (cursor > horizon) break;

    const slot = await findRecurringSlot(supabase, series, cursor, durationMins, preferred_staff_id);
    if (!slot) {
      console.warn(`No slot found for series ${seriesId} on ${cursor.toISOString().split('T')[0]}`);
      continue;
    }

    const dateStr = cursor.toISOString().split('T')[0];
    const startIso = new Date(`${dateStr}T${slot.time}:00`).toISOString();
    const endIso = new Date(new Date(`${dateStr}T${slot.time}:00`).getTime() + durationMins * 60000).toISOString();

    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        customer_id,
        staff_id: slot.staff_id,
        service_id,
        start_datetime: startIso,
        end_datetime: endIso,
        status: 'confirmed',
        recurring_series_id: seriesId,
        source: 'online'
      })
      .select()
      .single();

    if (!error && booking) {
      bookings.push(booking);
    }
  }

  return bookings;
}

// ── Main handler ────────────────────────────────────────────────────────────
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

    // ── Create recurring series if needed ───────────────────────────────────
    let seriesId = null;
    if (is_recurring && recurring_interval && INTERVAL_DAYS[recurring_interval]) {
      const dayOfWeek = startDate.getDay();
      const timeStr = startDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/London' });

      try {
        const { data: series, error: seriesErr } = await supabase
          .from('recurring_series')
          .insert({
            customer_id: customer.id,
            service_id,
            preferred_staff_id: resolvedStaffId,
            interval: recurring_interval,
            preferred_time: timeStr,
            preferred_day_of_week: dayOfWeek,
            status: 'active'
          })
          .select()
          .single();

        if (seriesErr) {
          console.warn('Recurring series creation failed (schema not ready?):', seriesErr.message);
        } else {
          seriesId = series.id;
        }
      } catch (e) {
        console.warn('Recurring series creation failed (schema not ready?):', e.message);
      }
    }

    // ── Create first booking ────────────────────────────────────────────────
    let bookingPayload = {
      customer_id: customer.id,
      staff_id: resolvedStaffId,
      service_id,
      start_datetime: startDate.toISOString(),
      end_datetime: endDate.toISOString(),
      status: 'confirmed',
      source: 'online'
    };

    // Only add recurring fields if series was created (schema may not be ready)
    if (seriesId) {
      try {
        bookingPayload.is_recurring = true;
        bookingPayload.recurring_interval = recurring_interval;
        bookingPayload.recurring_series_id = seriesId;
      } catch (_) {}
    }

    let booking, bookingError;
    try {
      const result = await supabase
        .from('bookings')
        .insert(bookingPayload)
        .select()
        .single();
      booking = result.data;
      bookingError = result.error;
    } catch (e) {
      // If insert fails due to missing columns, try without recurring fields
      console.warn('Booking insert failed, retrying without recurring fields:', e.message);
      const fallbackPayload = {
        customer_id: customer.id,
        staff_id: resolvedStaffId,
        service_id,
        start_datetime: startDate.toISOString(),
        end_datetime: endDate.toISOString(),
        status: 'confirmed',
        source: 'online'
      };
      const result = await supabase
        .from('bookings')
        .insert(fallbackPayload)
        .select()
        .single();
      booking = result.data;
      bookingError = result.error;
    }

    if (bookingError || !booking) {
      console.error('Booking insert error:', bookingError);
      return res.status(500).json({ error: 'Failed to create booking. Please try again or call Reset MCR on 07702 598780.' });
    }

    // ── Fetch for emails ────────────────────────────────────────────────────
    const { data: service } = await supabase.from('services').select('name').eq('id', service_id).single();
    const { data: staffMember } = await supabase.from('staff').select('name').eq('id', resolvedStaffId).single();

    // Send emails via VPS Zoho proxy (await so it completes before Vercel freezes)
    try {
      await sendEmailsViaVps(
        booking, customer, service, staffMember,
        seriesId ? { interval: recurring_interval } : null
      );
    } catch (e) {
      console.error('Email proxy failed:', e.message);
    }

    // ── Generate future bookings for recurring series ──────────────────────
    if (seriesId) {
      try {
        const { data: series } = await supabase
          .from('recurring_series')
          .select('*')
          .eq('id', seriesId)
          .single();
        if (series) {
          await generateSeriesBookings(supabase, series, startDate);
        }
      } catch (e) {
        console.warn('Series booking generation failed:', e.message);
      }
    }

    return res.status(200).json({
      booking_id: booking.id,
      series_id: seriesId,
      success: true
    });
  } catch (error) {
    console.error('Booking error:', error);
    return res.status(500).json({ error: 'Failed to create booking' });
  }
}
