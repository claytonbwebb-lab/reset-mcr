-- Reset MCR — Add missing recurring columns to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS recurring_interval TEXT CHECK (recurring_interval IN ('weekly','fortnightly','3weekly','monthly'));
