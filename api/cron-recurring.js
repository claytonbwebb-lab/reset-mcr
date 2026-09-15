import { createClient } from '@supabase/supabase-js';

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

const PREBOOK_AHEAD_DAYS = 42; // 6 weeks

// — Find best available slot for a recurring booking —
async function findSlot(series, targetDate, durationMins) {
  const { preferred_time, preferred_day_of_week, preferred_staff_id } = series;
  const dow = targetDate.getDay();
  if (dow !== preferred_day_of_week) return null;

  const dateStr = targetDate.toISOString().split('T')[0];
  const [h, m] = preferred_time.split(':').map(Number);
  const preferredMins = h * 60 + m;

  async function isSlotFree(staffId, timeStr) {
    const startIso = new Date(`${dateStr}T${timeStr}:00`).toISOString();
    const endIso   = new Date(new Date(`${dateStr}T${timeStr}:00`).getTime() + durationMins * 60000).toISOString();

    // Staff availability
    const { data: avail } = await supabase
      .from('staff_availability')
      .select('start_time, end_time, break_start, break_end')
      .eq('staff_id', staffId)
      .eq('day_of_week', dow)
      .single();
    if (!avail) return false;

    const slotStartMins = parseInt(timeStr.split(':')[0]) * 60 + parseInt(timeStr.split(':')[1]);
    const slotEndMins   = slotStartMins + durationMins;
    const workStart     = parseInt(avail.start_time.split(':')[0]) * 60 + parseInt(avail.start_time.split(':')[1]);
    const workEnd       = parseInt(avail.end_time.split(':')[0]) * 60 + parseInt(avail.end_time.split(':')[1]);
    if (slotStartMins < workStart || slotEndMins > workEnd) return false;

    if (avail.break_start && avail.break_end) {
      const breakStart = parseInt(avail.break_start.split(':')[0]) * 60 + parseInt(avail.break_start.split(':')[1]);
      const breakEnd   = parseInt(avail.break_end.split(':')[0]) * 60 + parseInt(avail.break_end.split(':')[1]);
      if (slotStartMins < breakEnd && slotEndMins > breakStart) return false;
    }

    // Time off
    const { data: unavail } = await supabase
      .from('staff_unavailable')
      .select('start_datetime, end_datetime')
      .eq('staff_id', staffId)
      .lte('start_datetime', `${dateStr}T23:59:59`)
      .gte('end_datetime', `${dateStr}T00:00:00`);

    for (const u of unavail || []) {
      if (new Date(startIso) < new Date(u.end_datetime) && new Date(endIso) > new Date(u.start_datetime)) return false;
    }

    // Existing bookings
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

  // Preferred staff @ preferred time
  if (preferred_staff_id && await isSlotFree(preferred_staff_id, preferred_time)) {
    return { staff_id: preferred_staff_id, time: preferred_time };
  }

  // Any staff @ preferred time
  const { data: activeStaff } = await supabase
    .from('staff').select('id')
    .eq('is_active', true)
    .order('created_at');
  for (const s of activeStaff || []) {
    if (s.id === preferred_staff_id) continue;
    if (await isSlotFree(s.id, preferred_time)) return { staff_id: s.id, time: preferred_time };
  }

  // ±30/60 min with preferred staff
  if (preferred_staff_id) {
    for (const offset of [-30, 30, -60, 60]) {
      const tMins = preferredMins + offset;
      if (tMins < 0 || tMins > 1440) continue;
      const tStr = `${String(Math.floor(tMins / 60)).padStart(2, '0')}:${String(tMins % 60).padStart(2, '0')}`;
      if (await isSlotFree(preferred_staff_id, tStr)) return { staff_id: preferred_staff_id, time: tStr };
    }
  }

  // ±30/60 min with any staff
  for (const s of activeStaff || []) {
    if (s.id === preferred_staff_id) continue;
    for (const offset of [-30, 30, -60, 60]) {
      const tMins = preferredMins + offset;
      if (tMins < 0 || tMins > 1440) continue;
      const tStr = `${String(Math.floor(tMins / 60)).padStart(2, '0')}:${String(tMins % 60).padStart(2, '0')}`;
      if (await isSlotFree(s.id, tStr)) return { staff_id: s.id, time: tStr };
    }
  }

  return null;
}

export default async function handler(req, res) {
  const cronToken = req.headers['x-cron-secret'];
  if (cronToken !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { data: seriesList, error } = await supabase
      .from('recurring_series')
      .select('*')
      .eq('status', 'active');
    if (error) throw error;
    if (!seriesList?.length) {
      return res.status(200).json({ message: 'No active recurring series', generated: 0 });
    }

    const results = [];
    const horizon = new Date(Date.now() + PREBOOK_AHEAD_DAYS * 86400000);

    for (const series of seriesList) {
      const days = INTERVAL_DAYS[series.interval];
      if (!days) continue;

      const { data: durRow } = await supabase
        .from('staff_service_durations')
        .select('duration_mins')
        .eq('staff_id', series.preferred_staff_id)
        .eq('service_id', series.service_id)
        .single();
      const durationMins = durRow?.duration_mins || 30;

      // Latest confirmed booking in THIS series
      const { data: latest } = await supabase
        .from('bookings')
        .select('start_datetime')
        .eq('recurring_series_id', series.id)
        .neq('status', 'cancelled')
        .order('start_datetime', { ascending: false })
        .limit(1)
        .maybeSingle();

      let cursor = latest ? new Date(latest.start_datetime) : new Date(series.created_at);
      let generated = 0;

      // Advance to next occurrence after today (so we don't re-create past bookings)
      const today = new Date();
      while (cursor < today) {
        cursor = new Date(cursor.getTime() + days * 86400000);
      }

      // Fill out to 6 weeks ahead
      while (cursor <= horizon) {
        const dateStr = cursor.toISOString().split('T')[0];

        // Skip if already exists for this date in this series
        const { data: exists } = await supabase
          .from('bookings')
          .select('id')
          .eq('recurring_series_id', series.id)
          .gte('start_datetime', `${dateStr}T00:00:00`)
          .lt('start_datetime', `${dateStr}T23:59:59`)
          .neq('status', 'cancelled')
          .maybeSingle();

        if (!exists) {
          const slot = await findSlot(series, cursor, durationMins);
          if (slot) {
            const startIso = new Date(`${dateStr}T${slot.time}:00`).toISOString();
            const endIso   = new Date(new Date(`${dateStr}T${slot.time}:00`).getTime() + durationMins * 60000).toISOString();

            const { error: insErr } = await supabase.from('bookings').insert({
              customer_id: series.customer_id,
              staff_id: slot.staff_id,
              service_id: series.service_id,
              start_datetime: startIso,
              end_datetime: endIso,
              status: 'confirmed',
              recurring_series_id: series.id,
              source: 'online'
            });
            if (!insErr) generated++;
          }
        }

        cursor = new Date(cursor.getTime() + days * 86400000);
      }

      results.push({ series_id: series.id, generated });
    }

    const total = results.reduce((s, r) => s + r.generated, 0);
    return res.status(200).json({ message: 'Recurring bookings generated', total, series: results });

  } catch (err) {
    console.error('Cron error:', err);
    return res.status(500).json({ error: 'Failed' });
  }
}
