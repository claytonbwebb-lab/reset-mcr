export async function requireAuth(headers, supabase) {
  const staffName = headers['x-staff-name'];
  const staffId = headers['x-staff-id'];
  const password = headers['x-diary-password'];
  const envPassword = process.env.DIARY_PASSWORD;

  let resolvedStaffId = null;

  // Staff-based auth: look up by name first, then by ID
  if (staffName || staffId) {
    let staff = null;

    if (staffId) {
      const { data } = await supabase
        .from('staff')
        .select('id, name, diary_role, diary_password')
        .eq('id', staffId)
        .single();
      staff = data;
    }

    if (!staff && staffName) {
      const { data } = await supabase
        .from('staff')
        .select('id, name, diary_role, diary_password')
        .eq('name', staffName)
        .single();
      staff = data;
    }
    if (staff && staff.diary_password && password === staff.diary_password) {
      return { staff_id: staff.id, name: staff.name, role: staff.diary_role || 'barber' };
    }
  }

  // Fallback: legacy env password (admin access, no staff filtering)
  if (envPassword && password === envPassword) {
    return { staff_id: null, name: 'Admin', role: 'admin' };
  }

  throw new Error('Unauthorized');
}
