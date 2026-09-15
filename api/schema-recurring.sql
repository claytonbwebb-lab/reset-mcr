-- RESET MCR Booking System — Schema Update: Recurring Bookings

-- ── Recurring Series (manages indefinite repeat bookings) ──
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

-- Link bookings to their series
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recurring_series_id UUID REFERENCES recurring_series(id) ON DELETE SET NULL;

-- Add cancelled_by and cancellation_type for audit trail
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_by TEXT CHECK (cancelled_by IN ('customer','admin','system'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_series TEXT;

-- Index for fast series lookups
CREATE INDEX IF NOT EXISTS idx_bookings_series ON bookings(recurring_series_id, start_datetime);
CREATE INDEX IF NOT EXISTS idx_recurring_series_status ON recurring_series(status);
