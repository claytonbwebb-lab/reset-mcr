-- Reset MCR — allow 3-week recurring intervals on bookings rows
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_recurring_interval_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_recurring_interval_check
  CHECK (recurring_interval IN ('weekly','fortnightly','3weekly','monthly'));
