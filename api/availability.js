import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function addMinutes(timeStr, mins) {
  const [h, m] = timeStr.split(':').map(Number);
  const totalMins = h * 60 + m + mins;
  return `${String(Math.floor(totalMins / 60)).padStart(2, '0')}:${String(totalMins % 60).padStart(2, '0')}`;
}

function timeToMins(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function minsToTime(mins) {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { date, staff_id, service_id } = req.query;

    if (!date || !service_id) {
      return res.status(400).json({ error: 'date and service_id are required' });
    }

    const dateObj = new Date(date + 'T00:00:00');
    const dayOfWeek = dateObj.getDay(); // 0=Sunday, 6=Saturday

    // Determine which staff to check
    let staffIds = [];
    if (staff_id && staff_id !== 'any') {
      staffIds = [staff_id];
    } else {
      // Get all active staff
      const { data: allStaff } = await supabase
        .from('staff')
        .select('id')
        .eq('is_active', true);
      staffIds = allStaff ? allStaff.map(s => s.id) : [];
    }

    // Get service duration for each staff
    const durationMap = {};
    for (const sid of staffIds) {
      const { data: dur } = await supabase
        .from('staff_service_durations')
        .select('duration_mins')
        .eq('staff_id', sid)
        .eq('service_id', service_id)
        .single();
      durationMap[sid] = dur?.duration_mins || 30;
    }

    // Get staff availability for this day
    const availabilities = {};
    for (const sid of staffIds) {
      const { data: avail } = await supabase
        .from('staff_availability')
        .select('start_time, end_time, break_start, break_end')
        .eq('staff_id', sid)
        .eq('day_of_week', dayOfWeek)
        .single();
      if (avail) {
        availabilities[sid] = avail;
      }
    }

    // Get staff unavailable periods for this date
    const unavailableMap = {};
    for (const sid of staffIds) {
      const { data: unavail } = await supabase
        .from('staff_unavailable')
        .select('start_datetime, end_datetime')
        .eq('staff_id', sid)
        .lte('start_datetime', date + 'T23:59:59')
        .gte('end_datetime', date + 'T00:00:00');
      unavailableMap[sid] = unavail || [];
    }

    // Get existing bookings for this date for relevant staff
    const { data: existingBookings } = await supabase
      .from('bookings')
      .select('staff_id, start_datetime, end_datetime, status')
      .in('staff_id', staffIds)
      .gte('start_datetime', date + 'T00:00:00')
      .lte('start_datetime', date + 'T23:59:59')
      .neq('status', 'cancelled');

    // Generate available slots for each staff
    const allSlots = [];

    for (const sid of staffIds) {
      const avail = availabilities[sid];
      if (!avail) continue;

      const duration = durationMap[sid];
      const workStart = timeToMins(avail.start_time);
      const workEnd = timeToMins(avail.end_time);
      const breakStart = avail.break_start ? timeToMins(avail.break_start) : null;
      const breakEnd = avail.break_end ? timeToMins(avail.break_end) : null;

      // Generate 30-min slots
      for (let slotStart = workStart; slotStart + duration <= workEnd; slotStart += 30) {
        const slotEnd = slotStart + duration;
        const slotEndTime = minsToTime(slotEnd);

        // Check if slot overlaps with break
        if (breakStart !== null && breakEnd !== null) {
          if (slotStart < breakEnd && slotEnd > breakStart) continue;
        }

        // Check unavailable periods
        const slotDateTime = new Date(`${date}T${minsToTime(slotStart)}:00`);
        const slotEndDateTime = new Date(`${date}T${slotEndTime}:00`);
        let blocked = false;
        for (const unavail of unavailableMap[sid]) {
          const uStart = new Date(unavail.start_datetime);
          const uEnd = new Date(unavail.end_datetime);
          if (slotDateTime < uEnd && slotEndDateTime > uStart) {
            blocked = true;
            break;
          }
        }
        if (blocked) continue;

        // Check existing bookings
        let booked = false;
        for (const b of existingBookings || []) {
          if (b.staff_id !== sid) continue;
          const bStart = new Date(b.start_datetime);
          const bEnd = new Date(b.end_datetime);
          if (slotDateTime < bEnd && slotEndDateTime > bStart) {
            booked = true;
            break;
          }
        }
        if (booked) continue;

        // Past time check (only for today)
        const now = new Date();
        const slotDateTimeFull = new Date(`${date}T${minsToTime(slotStart)}:00`);
        if (slotDateTimeFull <= now) continue;

        allSlots.push({
          time: minsToTime(slotStart),
          staff_id: sid,
          duration_mins: duration
        });
      }
    }

    // If staff_id = 'any', sort by time and deduplicate (keep first available for each time)
    if (!staff_id || staff_id === 'any') {
      allSlots.sort((a, b) => a.time.localeCompare(b.time));
    }

    // Remove duplicate times (prefer Jack if 'any')
    const seen = new Set();
    const dedupedSlots = allSlots.filter(slot => {
      if (staff_id === 'any' || !staff_id) {
        if (seen.has(slot.time)) return false;
        seen.add(slot.time);
        return true;
      }
      return true;
    });

    return res.status(200).json({ slots: dedupedSlots });
  } catch (error) {
    console.error('Availability error:', error);
    return res.status(500).json({ error: 'Failed to fetch availability' });
  }
}
