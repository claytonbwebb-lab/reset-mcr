import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const name = req.query.name || req.headers['x-staff-name'];
  const pw = req.headers['x-diary-password'];

  // Find staff
  const { data: staff, error } = await supabase
    .from('staff')
    .select('id, name, diary_role, diary_password')
    .eq('name', name)
    .single();

  // Return diagnostic info (hide actual password)
  res.status(200).json({
    queried_name: name,
    sent_password_length: pw ? pw.length : 0,
    found_staff: !!staff,
    staff_id: staff?.id || null,
    staff_name: staff?.name || null,
    diary_role: staff?.diary_role || null,
    diary_password_set: !!staff?.diary_password,
    diary_password_length: staff?.diary_password ? staff.diary_password.length : 0,
    db_error: error?.message || null,
    legacy_password_length: process.env.DIARY_PASSWORD ? process.env.DIARY_PASSWORD.length : 0
  });
}
