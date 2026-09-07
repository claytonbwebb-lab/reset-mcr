import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DIARY_PASSWORD = process.env.DIARY_PASSWORD;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Simple password check
  const password = req.headers['x-diary-password'];
  if (DIARY_PASSWORD && password !== DIARY_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { action, ...params } = req.body;

    switch (action) {
      case 'move': {
        // Move booking to new time
        const { booking_id, new_start_datetime } = params;
        if (!booking_id || !new_start_datetime) {
          return res.status(400).json({ error: 'booking_id and new_start_datetime required' });
        }

        // Get current booking duration
        const { data: old } = await supabase
          .from('bookings')
          .select('start_datetime, end_datetime')
          .eq('id', booking_id)
          .single();

        if (!old) return res.status(404).json({ error: 'Booking not found' });

        const oldDuration = (new Date(old.end_datetime) - new Date(old.start_datetime)) / 60000;
        const newStart = new Date(new_start_datetime);
        const newEnd = new Date(newStart.getTime() + oldDuration * 60000);

        const { error } = await supabase
          .from('bookings')
          .update({ start_datetime: newStart.toISOString(), end_datetime: newEnd.toISOString() })
          .eq('id', booking_id);

        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      case 'block': {
        const { customer_id } = params;
        if (!customer_id) return res.status(400).json({ error: 'customer_id required' });
        const { error } = await supabase
          .from('customers')
          .update({ is_blocked: true })
          .eq('id', customer_id);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      case 'unblock': {
        const { customer_id } = params;
        if (!customer_id) return res.status(400).json({ error: 'customer_id required' });
        const { error } = await supabase
          .from('customers')
          .update({ is_blocked: false, consecutive_no_shows: 0 })
          .eq('id', customer_id);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      case 'timeoff': {
        const { staff_id, start_datetime, end_datetime, reason } = params;
        if (!staff_id || !start_datetime || !end_datetime) {
          return res.status(400).json({ error: 'staff_id, start_datetime, end_datetime required' });
        }
        const { error } = await supabase
          .from('staff_unavailable')
          .insert({ staff_id, start_datetime, end_datetime, reason: reason || null });
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      case 'add': {
        // Add manual booking (full params)
        const { service_id, staff_id, start_datetime, customer_name, customer_email, customer_mobile } = params;
        if (!service_id || !staff_id || !start_datetime || !customer_name || !customer_email) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        const { data: dur } = await supabase
          .from('staff_service_durations')
          .select('duration_mins')
          .eq('staff_id', staff_id)
          .eq('service_id', service_id)
          .single();

        const durationMins = dur?.duration_mins || 30;
        const startDate = new Date(start_datetime);
        const endDate = new Date(startDate.getTime() + durationMins * 60000);

        const { data: customer } = await supabase
          .from('customers')
          .upsert({ name: customer_name, email: customer_email, mobile: customer_mobile || null }, { onConflict: 'email' })
          .select()
          .single();

        const { data: booking, error } = await supabase
          .from('bookings')
          .insert({
            customer_id: customer?.id,
            staff_id,
            service_id,
            start_datetime: startDate.toISOString(),
            end_datetime: endDate.toISOString(),
            status: 'confirmed',
            source: 'online'
          })
          .select()
          .single();

        if (error) throw error;
        return res.status(200).json({ booking_id: booking.id, success: true });
      }

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Admin error:', error);
    return res.status(500).json({ error: 'Admin action failed' });
  }
}
