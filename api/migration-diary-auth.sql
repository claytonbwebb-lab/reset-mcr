-- Migration: Add diary auth columns to staff table
-- Run this in Supabase SQL Editor BEFORE deploying the new diary code

ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS diary_role TEXT DEFAULT 'barber',
  ADD COLUMN IF NOT EXISTS diary_password TEXT;

-- Set Jack as admin (change 'JackPasswordHere' to the real password)
UPDATE staff
  SET diary_role = 'admin',
      diary_password = 'Reset2026!'
  WHERE name = 'Jack';

-- Set Jaden as barber (change 'JadenPasswordHere' to the real password)
UPDATE staff
  SET diary_role = 'barber',
      diary_password = 'Reset2026!'
  WHERE name = 'Jaden';

-- Verify
SELECT id, name, role, diary_role FROM staff;
