import { createClient } from '@supabase/supabase-js';
import { ukLocalToUtcIso } from './_ukTime.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DIARY_PASSWORD = process.env.DIARY_PASSWORD || 'reset2026';

async function requireAuth(headers) {
  if (DIARY_PASSWORD && headers['x-diary-password'] !== DIARY_PASSWORD) {
    throw new Error('Unauthorized');
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await requireAuth(req.headers);
  } catch (e) {
    return res.status(401).json({ error: e.message });
  }

  try {
    const { action, ...params } = req.body;

    switch (action) {

      case 'move': {
        const { booking_id, new_start_datetime } = params;
        if (!booking_id || !new_start_datetime) {
          return res.status(400).json({ error: 'booking_id and new_start_datetime required' });
        }
        const { data: old } = await supabase
          .from('bookings')
          .select('start_datetime, end_datetime')
          .eq('id', booking_id)
          .single();
        if (!old) return res.status(404).json({ error: 'Booking not found' });
        const oldDuration = (new Date(old.end_datetime) - new Date(old.start_datetime)) / 60000;
        const newStart = new Date(ukLocalToUtcIso(new_start_datetime));
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

      // ─── Availability (staff working hours) ───────────────────────────────────

      case 'get_availability': {
        const { staff_id } = params;
        if (!staff_id) return res.status(400).json({ error: 'staff_id required' });
        const { data } = await supabase
          .from('staff_availability')
          .select('id, day_of_week, start_time, end_time, break_start, break_end')
          .eq('staff_id', staff_id)
          .order('day_of_week');
        return res.status(200).json({ availability: data || [] });
      }

      case 'set_availability': {
        // Upsert a single day-of-week row
        const { staff_id, day_of_week, start_time, end_time, break_start, break_end } = params;
        if (!staff_id || day_of_week === undefined || !start_time || !end_time) {
          return res.status(400).json({ error: 'staff_id, day_of_week, start_time, end_time required' });
        }
        // Delete existing for this staff+day, then insert
        await supabase
          .from('staff_availability')
          .delete()
          .eq('staff_id', staff_id)
          .eq('day_of_week', Number(day_of_week));
        const { error } = await supabase
          .from('staff_availability')
          .insert({
            staff_id,
            day_of_week: Number(day_of_week),
            start_time,
            end_time,
            break_start: break_start || null,
            break_end: break_end || null
          });
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      case 'remove_availability': {
        const { id } = params;
        if (!id) return res.status(400).json({ error: 'id required' });
        const { error } = await supabase
          .from('staff_availability')
          .delete()
          .eq('id', id);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      // ─── Time-off ────────────────────────────────────────────────────────────

      case 'get_timeoff': {
        const { staff_id } = params;
        let query = supabase
          .from('staff_unavailable')
          .select('id, staff_id, start_datetime, end_datetime, reason')
          .gte('end_datetime', new Date().toISOString())
          .order('start_datetime');
        if (staff_id) query = query.eq('staff_id', staff_id);
        const { data } = await query;
        return res.status(200).json({ timeoff: data || [] });
      }

      case 'add_timeoff': {
        const { staff_id, start_datetime, end_datetime, reason } = params;
        if (!staff_id || !start_datetime || !end_datetime) {
          return res.status(400).json({ error: 'staff_id, start_datetime, end_datetime required' });
        }
        const { error } = await supabase
          .from('staff_unavailable')
          .insert({ staff_id, start_datetime: ukLocalToUtcIso(start_datetime), end_datetime: ukLocalToUtcIso(end_datetime), reason: reason || null });
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      case 'remove_timeoff': {
        const { id } = params;
        if (!id) return res.status(400).json({ error: 'id required' });
        const { error } = await supabase
          .from('staff_unavailable')
          .delete()
          .eq('id', id);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      // ─── Manual booking ───────────────────────────────────────────────────────

      case 'add': {
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
        const startDate = new Date(ukLocalToUtcIso(start_datetime));
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

      // ─── Staff CRUD ────────────────────────────────────────────────────────

      case 'create_staff': {
        const { name, role, bio } = params;
        if (!name || !role) return res.status(400).json({ error: 'name and role required' });
        const { data, error } = await supabase
          .from('staff')
          .insert({ name, role, bio: bio || null })
          .select()
          .single();
        if (error) throw error;
        return res.status(200).json({ staff: data });
      }

      case 'update_staff': {
        const { id, name, role, bio } = params;
        if (!id) return res.status(400).json({ error: 'id required' });
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (role !== undefined) updates.role = role;
        if (bio !== undefined) updates.bio = bio;
        const { data, error } = await supabase
          .from('staff')
          .update(updates)
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return res.status(200).json({ staff: data });
      }

      case 'delete_staff': {
        const { id } = params;
        if (!id) return res.status(400).json({ error: 'id required' });
        // Soft-delete: set is_active = false
        const { error } = await supabase
          .from('staff')
          .update({ is_active: false })
          .eq('id', id);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      case 'set_service_durations': {
        // params: staff_id, durations: [{ service_id, duration_mins }]
        const { staff_id, durations } = params;
        if (!staff_id || !durations) return res.status(400).json({ error: 'staff_id and durations required' });
        // Replace all durations for this staff
        await supabase.from('staff_service_durations').delete().eq('staff_id', staff_id);
        const inserts = durations.map(d => ({ staff_id, service_id: d.service_id, duration_mins: Number(d.duration_mins) }));
        const { error } = await supabase.from('staff_service_durations').insert(inserts);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      // ─── Customer search ─────────────────────────────────────────────────────

      case 'search_customers': {
        const { q } = params;
        if (!q || q.length < 2) return res.status(200).json({ customers: [] });
        const { data } = await supabase
          .from('customers')
          .select('id, name, email, mobile, is_blocked, consecutive_no_shows')
          .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
          .limit(10);
        return res.status(200).json({ customers: data || [] });
      }

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (error) {
    console.error('Admin error:', error);
    return res.status(500).json({ error: 'Admin action failed' });
  }
}
