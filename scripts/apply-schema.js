import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const key = readFileSync(process.env.HOME + '/.openclaw-credentials-backup/resetmcr-supabase-service-role.txt', 'utf8').trim();
const url = 'https://awvuhjeajygltoxmtesy.supabase.co';

const supabase = createClient(url, key, {
  auth: { persistSession: false }
});

const statements = [
  `CREATE TABLE IF NOT EXISTS recurring_series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES services(id),
    preferred_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    interval TEXT NOT NULL CHECK (interval IN ('weekly','fortnightly','3weekly','monthly')),
    preferred_time TIME NOT NULL,
    preferred_day_of_week INT NOT NULL CHECK (preferred_day_of_week BETWEEN 0 AND 6),
    status TEXT DEFAULT 'active' CHECK (status IN ('active','cancelled','ended')),
    created_at TIMESTAMPTZ DEFAULT now()
  )`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recurring_series_id UUID REFERENCES recurring_series(id) ON DELETE SET NULL`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_by TEXT CHECK (cancelled_by IN ('customer','admin','system'))`,
  `ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_series TEXT`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_series ON bookings(recurring_series_id, start_datetime)`,
  `CREATE INDEX IF NOT EXISTS idx_recurring_series_status ON recurring_series(status)`
];

async function run() {
  console.log('Applying schema via exec_sql...\n');
  for (const sql of statements) {
    const { data, error } = await supabase.rpc('exec_sql', { query: sql });
    if (error) {
      console.error('❌ ERROR:', error.message);
      console.error('   SQL:', sql.substring(0, 80).replace(/\s+/g, ' '));
    } else {
      console.log('✅ OK:', sql.substring(0, 60).replace(/\s+/g, ' '));
    }
  }
  console.log('\nDone.');
}

run().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
