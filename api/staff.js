import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DIARY_PASSWORD = process.env.DIARY_PASSWORD || 'reset2026';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const password = req.headers['x-diary-password'];
  if (DIARY_PASSWORD && password !== DIARY_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { data: staff } = await supabase
      .from('staff')
      .select('id, name, role, bio, photo_url, is_active')
      .order('name');

    const { data: services } = await supabase
      .from('services')
      .select('id, name, is_active')
      .eq('is_active', true)
      .order('name');

    const { data: durations } = await supabase
      .from('staff_service_durations')
      .select('staff_id, service_id, duration_mins');

    return res.status(200).json({
      staff: staff || [],
      services: services || [],
      durations: durations || []
    });
  } catch (error) {
    console.error('Staff error:', error);
    return res.status(500).json({ error: 'Failed to fetch staff/services' });
  }
}
