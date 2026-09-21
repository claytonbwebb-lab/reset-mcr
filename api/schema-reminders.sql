-- Reset MCR — booking reminder tracking
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_bookings_reminder_24h ON bookings(start_datetime) WHERE reminder_24h_sent_at IS NULL AND status = 'confirmed';
