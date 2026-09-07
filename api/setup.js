// One-time setup script to create tables in Supabase
// Run once: npx vercel dev --token <token> or deploy and call the endpoint
// Actually just use the Supabase dashboard SQL editor
// This file is a reference — do not deploy

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const schema = `
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price_pence INT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  bio TEXT,
  photo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_service_durations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  duration_mins INT NOT NULL,
  UNIQUE(staff_id, service_id)
);

CREATE TABLE IF NOT EXISTS staff_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_start TIME,
  break_end TIME
);

CREATE TABLE IF NOT EXISTS staff_unavailable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ NOT NULL,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  mobile TEXT,
  no_show_count INT DEFAULT 0,
  consecutive_no_shows INT DEFAULT 0,
  is_blocked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(email)
);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  staff_id UUID REFERENCES staff(id),
  service_id UUID REFERENCES services(id),
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed','attended','no_show','cancelled')),
  is_recurring BOOLEAN DEFAULT false,
  recurring_interval TEXT CHECK (recurring_interval IN ('weekly','fortnightly','monthly')),
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  source TEXT DEFAULT 'online' CHECK (source IN ('online','walk_in'))
);

CREATE INDEX IF NOT EXISTS idx_bookings_staff_date ON bookings(staff_id, start_datetime);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_staff_availability_day ON staff_availability(staff_id, day_of_week);
`;

// Note: DDL must be run via Supabase Dashboard SQL Editor or psql
// The Supabase JS client (REST API) cannot run DDL statements
// Please run api/schema.sql and api/seed.sql in the Supabase SQL Editor
console.log('To create tables:');
console.log('1. Go to https://supabase.com/dashboard');
console.log('2. Select project suyrbsuuckcvhdvxcvsf');
console.log('3. Go to SQL Editor');
console.log('4. Run api/schema.sql then api/seed.sql');
export default async (req, res) => {
  res.status(200).json({ message: 'Use Supabase Dashboard SQL Editor to run schema.sql and seed.sql' });
};
