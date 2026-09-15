import { createClient } from '@supabase/supabase-js';
import { ukLocalToUtcIso } from './_ukTime.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const INTERVAL_DAYS = {
  weekly: 7,
  fortnightly: 14,
  '3weekly': 21,
  monthly: 30
};
const PREBOOK_AHEAD_DAYS = 28;
const VPS_EMAIL_URL = 'http://13.49.47.171/api/resetmcr/booking-email';

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

async function findRecurringSlot(series, targetDate, durationMins, preferredStaffId) {
  const { preferred_time, preferred_day_of_week } = series;
  const dow = targetDate.getDay();
  if (dow !== preferred_day_of_week) return null;

  const dateStr = targetDate.toISOString().split('T')[0];
  const startTimeStr = preferred_time;

  async function isSlotFree(staffId, timeStr) {
    const startIso = new Date(`${dateStr}T${timeStr}:00`).toISOString();
    const endIso = new Date(new Date(`${dateStr}T${timeStr}:00`).getTime() + durationMins * 60000).toISOString();

    const { data: avail } = await supabase
      .from('staff_availability')
      .select('start_time, end_time, break_start, break_end')
      .eq('staff_id', staffId)
      .eq('day_of_week', dow)
      .single();
    if (!avail) return false;

    const slotStartMins = parseInt(timeStr.split(':')[0]) * 60 + parseInt(timeStr.split(':')[1]);
    const slotEndMins = slotStartMins + durationMins;
    const workStart = parseInt(avail.start_time.split(':')[0]) * 60 + parseInt(avail.start_time.split(':')[1]);
    const workEnd = parseInt(avail.end_time.split(':')[0]) * 60 + parseInt(avail.end_time.split(':')[1]);

    if (slotStartMins < workStart || slotEndMins > workEnd) return false;

    if (avail.break_start && avail.break_end) {
      const breakStartMins = parseInt(avail.break_start.split(':')[0]) * 60 + parseInt(avail.break_start.split(':')[1]);
      const breakEndMins = parseInt(avail.break_end.split(':')[0]) * 60 + parseInt(avail.break_end.split(':')[1]);
      if (slotStartMins < breakEndMins && slotEndMins > breakStartMins) return false;
    }

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

  if (preferredStaffId && await isSlotFree(preferredStaffId, startTimeStr)) {
    return { staff_id: preferredStaffId, time: startTimeStr };
  }

  const { data: activeStaff } = await supabase.from('staff').select('id, name, created_at').eq('is_active', true).order('created_at');
  for (const s of activeStaff || []) {
    if (s.id === preferredStaffId) continue;
    if (await isSlotFree(s.id, startTimeStr)) return { staff_id: s.id, time: startTimeStr };
  }

  if (preferredStaffId) {
    for (const offset of [-30, 30, -60, 60, -90, 90]) {
      const tMins = parseInt(startTimeStr.split(':')[0]) * 60 + parseInt(startTimeStr.split(':')[1]) + offset;
      if (tMins < 0 || tMins > 1440) continue;
      const tStr = `${String(Math.floor(tMins / 60)).padStart(2, '0')}:${String(tMins % 60).padStart(2, '0')}`;
      if (await isSlotFree(preferredStaffId, tStr)) return { staff_id: preferredStaffId, time: tStr };
    }
  }

  for (const s of activeStaff || []) {
    if (s.id === preferredStaffId) continue;
    for (const offset of [-30, 30, -60, 60, -90, 90]) {
      const tMins = parseInt(startTimeStr.split(':')[0]) * 60 + parseInt(startTimeStr.split(':')[1]) + offset;
      if (tMins < 0 || tMins > 1440) continue;
      const tStr = `${String(Math.floor(tMins / 60)).padStart(2, '0')}:${String(tMins % 60).padStart(2, '0')}`;
      if (await isSlotFree(s.id, tStr)) return { staff_id: s.id, time: tStr };
    }
  }

  return null;
}

async function sendEmail(booking, customer, service, staffName) {
  try {
    await fetch(VPS_EMAIL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerEmail: customer.email,
        customerName: customer.name,
        barberName: staffName,
        serviceName: service.name,
        date: formatDate(booking.start_datetime),
        time: formatTime(booking.start_datetime),
        cancelLink: `https://resetmcr.com/?cancel=${booking.id}&email=${encodeURIComponent(customer.email)}`,
        adminEmails: [process.env.JACK_EMAIL || 'jack@resetmcr.com'],
        extraNote: 'Part of a recurring series.'
      })
    });
  } catch (e) {
    console.error('Email proxy failed:', e.message);
  }
}

export default async function handler(req, res) {
  // Simple auth: require CRON_SECRET header (set in Vercel env vars)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const provided = req.headers['x-cron-secret'] || req.headers['authorization'];
    if (!provided || provided !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const start = Date.now();
  const results = [];

  try {
    // Get all active recurring series that need future bookings
    const { data: activeSeries, error } = await supabase
      .from('recurring_series')
      .select('id, customer_id, service_id, preferred_staff_id, interval, preferred_time, preferred_day_of_week')
      .eq('status', 'active');

    if (error) throw error;

    for (const series of activeSeries || []) {
      const days = INTERVAL_DAYS[series.interval];
      if (!days) continue;

      // Get duration
      const { data: durRow } = await supabase
        .from('staff_service_durations')
        .select('duration_mins')
        .eq('staff_id', series.preferred_staff_id)
        .eq('service_id', series.service_id)
        .single();
      const durationMins = durRow?.duration_mins || 30;

      // Find latest booking in this series
      const { data: latest } = await supabase
        .from('bookings')
        .select('start_datetime')
        .eq('recurring_series_id', series.id)
        .neq('status', 'cancelled')
        .order('start_datetime', { ascending: false })
        .limit(1)
        .single();

      if (!latest) {
        results.push({ series_id: series.id, status: 'no_last_booking' });
        continue;
      }

      let cursor = new Date(latest.start_datetime);
      const horizon = new Date(Date.now() + PREBOOK_AHEAD_DAYS * 86400000);
      let created = 0;
      let failed = 0;

      while (cursor <= horizon) {
        cursor = new Date(cursor.getTime() + days * 86400000);
        if (cursor > horizon) break;

        // Skip if already booked on this date for this series
        const dateStr = cursor.toISOString().split('T')[0];
        const { data: existingOnDate } = await supabase
          .from('bookings')
          .select('id')
          .eq('recurring_series_id', series.id)
          .gte('start_datetime', `${dateStr}T00:00:00`)
          .lte('start_datetime', `${dateStr}T23:59:59`)
          .neq('status', 'cancelled')
          .limit(1)
          .maybeSingle();

        if (existingOnDate) continue;

        const slot = await findRecurringSlot(series, cursor, durationMins, series.preferred_staff_id);
        if (!slot) {
          failed++;
          continue;
        }

        const startIso = new Date(`${dateStr}T${slot.time}:00`).toISOString();
        const endIso = new Date(new Date(`${dateStr}T${slot.time}:00`).getTime() + durationMins * 60000).toISOString();

        const { data: booking, error: bErr } = await supabase
          .from('bookings')
          .insert({
            customer_id: series.customer_id,
            staff_id: slot.staff_id,
            service_id: series.service_id,
            start_datetime: startIso,
            end_datetime: endIso,
            status: 'confirmed',
            recurring_series_id: series.id,
            source: 'online'
          })
          .select()
          .single();

        if (bErr) {
          failed++;
          console.error(`Failed to create booking for series ${series.id}:`, bErr);
        } else {
          created++;
          // Send notification email (don't block on failures)
          const { data: customer } = await supabase.from('customers').select('name, email').eq('id', series.customer_id).single();
          const { data: service } = await supabase.from('services').select('name').eq('id', series.service_id).single();
          const { data: staff } = await supabase.from('staff').select('name').eq('id', slot.staff_id).single();
          if (customer && service && staff) {
            sendEmail(booking, customer, service, staff.name).catch(() => {});
          }
        }
      }

      results.push({
        series_id: series.id,
        status: 'ok',
        created,
        failed
      });
    }

    return res.status(200).json({
      success: true,
      series_processed: activeSeries?.length || 0,
      results,
      duration_ms: Date.now() - start
    });
  } catch (err) {
    console.error('Refresh error:', err);
    return res.status(500).json({ error: 'Refresh failed', details: err.message });
  }
}
