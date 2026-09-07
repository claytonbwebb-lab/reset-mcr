import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = 'hello@resetmcr.com';
const JACK_EMAIL = process.env.JACK_EMAIL || 'hello@resetmcr.com';

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
    const startDate = new Date(start_datetime);
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

    // Send Jack notification
    const { data: service } = await supabase.from('services').select('name').eq('id', service_id).single();
    const { data: staffMember } = await supabase.from('staff').select('name').eq('id', staff_id).single();

    await resend.emails.send({
      from: FROM_EMAIL,
      to: JACK_EMAIL,
      subject: `Walk-in — ${service?.name} with ${customer_name}`,
      html: `
        <div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:0 auto;color:#f7f3ec;background:#050505;padding:40px;border-radius:24px;">
          <h1 style="font-family:Oswald,sans-serif;text-transform:uppercase;font-size:28px;color:#e3c89c;margin:0 0 24px;">Walk-in Added</h1>
          <div style="background:#0b0b0b;border:1px solid rgba(255,255,255,.12);border-radius:20px;padding:28px;">
            <table style="width:100%;border-collapse:collapse;">
              <tr><td style="color:#b6ada0;font-size:13px;padding:6px 0;">Customer</td><td style="text-align:right;color:#f7f3ec;font-weight:700;padding:6px 0;">${customer_name}</td></tr>
              <tr><td style="color:#b6ada0;font-size:13px;padding:6px 0;">Mobile</td><td style="text-align:right;color:#f7f3ec;padding:6px 0;">${customer_mobile || '—'}</td></tr>
              <tr><td style="color:#b6ada0;font-size:13px;padding:6px 0;">Service</td><td style="text-align:right;color:#f7f3ec;font-weight:700;padding:6px 0;">${service?.name}</td></tr>
              <tr><td style="color:#b6ada0;font-size:13px;padding:6px 0;">Barber</td><td style="text-align:right;color:#f7f3ec;font-weight:700;padding:6px 0;">${staffMember?.name}</td></tr>
              <tr><td style="color:#b6ada0;font-size:13px;padding:6px 0;">Date</td><td style="text-align:right;color:#f7f3ec;font-weight:700;padding:6px 0;">${formatDate(startDate.toISOString())}</td></tr>
              <tr><td style="color:#b6ada0;font-size:13px;padding:6px 0;">Time</td><td style="text-align:right;color:#f7f3ec;font-weight:700;padding:6px 0;">${formatTime(startDate.toISOString())}</td></tr>
            </table>
          </div>
        </div>
      `
    }).catch(e => console.error('Walk-in notification failed:', e.message));

    return res.status(200).json({ booking_id: booking.id, success: true });
  } catch (error) {
    console.error('Walk-in error:', error);
    return res.status(500).json({ error: 'Failed to add walk-in' });
  }
}
