import { createClient } from '@supabase/supabase-js';
import { ukLocalToUtcIso } from './_ukTime.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VPS_EMAIL_URL = 'http://13.49.47.171/api/resetmcr/walkin-email';
const JACK_EMAIL = process.env.JACK_EMAIL || 'jack@resetmcr.com';

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { service_id, staff_id, start_datetime, customer_name, customer_mobile } = req.body;

    if (!service_id || !staff_id || !start_datetime || !customer_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get duration
    const { data: durationRow } = await supabase
      .from('staff_service_durations')
      .select('duration_mins')
      .eq('staff_id', staff_id)
      .eq('service_id', service_id)
      .single();

    const durationMins = durationRow?.duration_mins || 30;
    const startDate = new Date(ukLocalToUtcIso(start_datetime));
    const endDate = new Date(startDate.getTime() + durationMins * 60000);

    // Upsert customer (no email for walk-ins)
    const { data: customer } = await supabase
      .from('customers')
      .upsert({ name: customer_name, email: `walkin_${Date.now()}@placeholder.local`, mobile: customer_mobile || null }, { onConflict: 'email' })
      .select()
      .single();

    // Insert booking
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        customer_id: customer?.id,
        staff_id,
        service_id,
        start_datetime: startDate.toISOString(),
        end_datetime: endDate.toISOString(),
        status: 'confirmed',
        source: 'walk_in'
      })
      .select()
      .single();

    if (error) throw error;

    // Send Jack notification via VPS
    const { data: service } = await supabase.from('services').select('name').eq('id', service_id).single();
    const { data: staffMember } = await supabase.from('staff').select('name').eq('id', staff_id).single();

    try {
      await fetch(VPS_EMAIL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customer_name,
          customerMobile: customer_mobile || null,
          serviceName: service?.name,
          barberName: staffMember?.name,
          date: formatDate(startDate.toISOString()),
          time: formatTime(startDate.toISOString())
        })
      });
    } catch (e) {
      console.error('Walk-in email proxy failed:', e.message);
    }

    return res.status(200).json({ booking_id: booking.id, success: true });
  } catch (error) {
    console.error('Walk-in error:', error);
    return res.status(500).json({ error: 'Failed to add walk-in' });
  }
}
