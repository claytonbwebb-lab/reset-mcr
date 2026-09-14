import { createClient } from '@supabase/supabase-js';
import { ukDateStartUtc, ukDateEndUtc } from './_ukTime.js';
import { requireAuth } from './_auth.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let auth;
  try {
    auth = await requireAuth(req.headers, supabase);
  } catch (e) {
    return res.status(401).json({ error: e.message });
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

    // For barber role, filter to only their own bookings
    if (auth.role === 'barber' && auth.staff_id) {
      query = query.eq('staff_id', auth.staff_id);
    } else if (staff_id) {
      query = query.eq('staff_id', staff_id);
    }

    const { data: bookings, error } = await query;

    if (error) throw error;

    // Calculate capacity % for weekly view
    let capacity = null;
    if (view === 'weekly') {
      const bookedMins = (bookings || []).reduce((acc, b) => {
        const s = new Date(b.start_datetime);
        const e = new Date(b.end_datetime);
        return acc + (e - s) / 60000;
      }, 0);

      // Get staff availability for the week
      // For barber role, only count their own availability
      let availQuery = supabase
        .from('staff_availability')
        .select('start_time, end_time, break_start, break_end');
      if (auth.role === 'barber' && auth.staff_id) {
        availQuery = availQuery.eq('staff_id', auth.staff_id);
      }
      const { data: availRows } = await availQuery;

      let totalAvailMins = 0;
      for (const a of availRows || []) {
        const start = new Date('1970-01-01T' + a.start_time);
        const end = new Date('1970-01-01T' + a.end_time);
        const breakS = a.break_start ? new Date('1970-01-01T' + a.break_start) : null;
        const breakE = a.break_end ? new Date('1970-01-01T' + a.break_end) : null;
        let dayMins = (end - start) / 60000;
        if (breakS && breakE) dayMins -= (breakE - breakS) / 60000;
        totalAvailMins += dayMins;
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
