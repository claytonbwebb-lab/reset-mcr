-- RESET MCR Recurring Bookings Schema (v2 — fixes policy syntax)

-- ── Recurring Series ──
CREATE TABLE IF NOT EXISTS recurring_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id),
  preferred_staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
  interval TEXT NOT NULL CHECK (interval IN ('weekly','fortnightly','3weekly','monthly')),
  preferred_time TIME NOT NULL,
  preferred_day_of_week INT NOT NULL CHECK (preferred_day_of_week BETWEEN 0 AND 6),
  status TEXT DEFAULT 'active' CHECK (status IN ('active','cancelled','ended')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Link bookings to series ──
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recurring_series_id UUID REFERENCES recurring_series(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_by TEXT CHECK (cancelled_by IN ('customer','admin','system'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_series TEXT;

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_bookings_series ON bookings(recurring_series_id, start_datetime);
CREATE INDEX IF NOT EXISTS idx_recurring_series_status ON recurring_series(status);

-- ── RLS ──
ALTER TABLE recurring_series ENABLE ROW LEVEL SECURITY;

-- Drop if exists, then create (avoids duplicate policy error)
DROP POLICY IF EXISTS "Allow all" ON recurring_series;

CREATE POLICY "Allow all" ON recurring_series FOR ALL USING (true) WITH CHECK (true);
