import { createClient } from '@supabase/supabase-js';
import { ukDateStartUtc, ukDateEndUtc } from './_ukTime.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { date, view = 'daily', staff_id } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }

    let query = supabase
      .from('bookings')
      .select(`
        id, start_datetime, end_datetime, status, is_recurring, recurring_interval,
        customer:customer_id(name, email, mobile),
        staff:staff_id(name, role),
        service:service_id(name)
      `)
      .neq('status', 'cancelled')
      .order('start_datetime');

    if (view === 'daily') {
      query = query
        .gte('start_datetime', ukDateStartUtc(date))
        .lte('start_datetime', ukDateEndUtc(date));
    } else if (view === 'weekly') {
      const weekStart = new Date(date + 'T00:00:00');
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      query = query
        .gte('start_datetime', ukDateStartUtc(weekStart.toISOString().split('T')[0]))
        .lte('start_datetime', ukDateEndUtc(weekEnd.toISOString().split('T')[0]));
    }

    if (staff_id) {
      query = query.eq('staff_id', staff_id);
    }

    const { data: bookings, error } = await query;

    if (error) throw error;

    // Calculate capacity % for weekly view
    let capacity = null;
    if (view === 'weekly') {
      // Total available minutes Mon-Sat (6 days) = 6 days * (8.5h - 0.5h break) = 6 * 8 * 60 = 2880? No: 6 * 8h = 2880? Wait: 09:00-18:00=9h, break=0.5h, so 8.5h = 510 mins per day. 510*6=3060 mins
      // Get total booked minutes
      const bookedMins = (bookings || []).reduce((acc, b) => {
        const s = new Date(b.start_datetime);
        const e = new Date(b.end_datetime);
        return acc + (e - s) / 60000;
      }, 0);

      // Get staff availability for the week
      const { data: availRows } = await supabase
        .from('staff_availability')
        .select('start_time, end_time, break_start, break_end');

      let totalAvailMins = 0;
      for (const a of availRows || []) {
        const start = new Date('1970-01-01T' + a.start_time);
        const end = new Date('1970-01-01T' + a.end_time);
        const breakS = a.break_start ? new Date('1970-01-01T' + a.break_start) : null;
        const breakE = a.break_end ? new Date('1970-01-01T' + a.break_end) : null;
        let dayMins = (end - start) / 60000;
        if (breakS && breakE) dayMins -= (breakE - breakS) / 60000;
        totalAvailMins += dayMins * 6; // 6 working days
      }

      capacity = totalAvailMins > 0 ? Math.round((bookedMins / totalAvailMins) * 100) : 0;
    }

    const formatted = (bookings || []).map(b => ({
      id: b.id,
      customer_name: b.customer?.name,
      customer_email: b.customer?.email,
      customer_mobile: b.customer?.mobile,
      service_name: b.service?.name,
      staff_name: b.staff?.name,
      staff_role: b.staff?.role,
      start: b.start_datetime,
      end: b.end_datetime,
      status: b.status,
      is_recurring: b.is_recurring,
      recurring_interval: b.recurring_interval
    }));

    return res.status(200).json({ bookings: formatted, capacity });
  } catch (error) {
    console.error('Diary error:', error);
    return res.status(500).json({ error: 'Failed to fetch diary' });
  }
}
