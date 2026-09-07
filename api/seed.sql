-- RESET MCR Booking System — Seed Data
-- Run AFTER schema.sql

-- Services (NO prices in UI — seed for reference only)
INSERT INTO services (name, price_pence) VALUES
  ('Haircut', 2500),
  ('Hair + Beard', 3000),
  ('Beard Only', 1500),
  ('Kids Cut', 1500),
  ('Cut-Throat Shave', 2000),
  ('Haircut + Cut-Throat', 4000);

-- Staff
INSERT INTO staff (name, role, bio) VALUES
  ('Jack', 'Senior Barber', 'Jack is the founder of Reset MCR — a precision barber with years of experience in skin fades, classic cuts and modern styling. Expect sharp work and a quality finish every time.'),
  ('Jaden', 'Apprentice', 'Jaden is our rising talent, learning the ropes at Reset MCR while building his skills in fades and beard work. Great option when you want expert oversight at an accessible price.');

-- Staff service durations
-- Jack's durations
INSERT INTO staff_service_durations (staff_id, service_id, duration_mins)
SELECT (SELECT id FROM staff WHERE name = 'Jack'), (SELECT id FROM services WHERE name = 'Haircut'), 30
ON CONFLICT DO NOTHING;
INSERT INTO staff_service_durations (staff_id, service_id, duration_mins)
SELECT (SELECT id FROM staff WHERE name = 'Jack'), (SELECT id FROM services WHERE name = 'Hair + Beard'), 45
ON CONFLICT DO NOTHING;
INSERT INTO staff_service_durations (staff_id, service_id, duration_mins)
SELECT (SELECT id FROM staff WHERE name = 'Jack'), (SELECT id FROM services WHERE name = 'Beard Only'), 20
ON CONFLICT DO NOTHING;
INSERT INTO staff_service_durations (staff_id, service_id, duration_mins)
SELECT (SELECT id FROM staff WHERE name = 'Jack'), (SELECT id FROM services WHERE name = 'Kids Cut'), 20
ON CONFLICT DO NOTHING;
INSERT INTO staff_service_durations (staff_id, service_id, duration_mins)
SELECT (SELECT id FROM staff WHERE name = 'Jack'), (SELECT id FROM services WHERE name = 'Cut-Throat Shave'), 30
ON CONFLICT DO NOTHING;
INSERT INTO staff_service_durations (staff_id, service_id, duration_mins)
SELECT (SELECT id FROM staff WHERE name = 'Jack'), (SELECT id FROM services WHERE name = 'Haircut + Cut-Throat'), 60
ON CONFLICT DO NOTHING;

-- Jaden's durations
INSERT INTO staff_service_durations (staff_id, service_id, duration_mins)
SELECT (SELECT id FROM staff WHERE name = 'Jaden'), (SELECT id FROM services WHERE name = 'Haircut'), 60
ON CONFLICT DO NOTHING;
INSERT INTO staff_service_durations (staff_id, service_id, duration_mins)
SELECT (SELECT id FROM staff WHERE name = 'Jaden'), (SELECT id FROM services WHERE name = 'Hair + Beard'), 80
ON CONFLICT DO NOTHING;
INSERT INTO staff_service_durations (staff_id, service_id, duration_mins)
SELECT (SELECT id FROM staff WHERE name = 'Jaden'), (SELECT id FROM services WHERE name = 'Beard Only'), 30
ON CONFLICT DO NOTHING;
INSERT INTO staff_service_durations (staff_id, service_id, duration_mins)
SELECT (SELECT id FROM staff WHERE name = 'Jaden'), (SELECT id FROM services WHERE name = 'Kids Cut'), 40
ON CONFLICT DO NOTHING;
INSERT INTO staff_service_durations (staff_id, service_id, duration_mins)
SELECT (SELECT id FROM staff WHERE name = 'Jaden'), (SELECT id FROM services WHERE name = 'Cut-Throat Shave'), 45
ON CONFLICT DO NOTHING;
INSERT INTO staff_service_durations (staff_id, service_id, duration_mins)
SELECT (SELECT id FROM staff WHERE name = 'Jaden'), (SELECT id FROM services WHERE name = 'Haircut + Cut-Throat'), 80
ON CONFLICT DO NOTHING;

-- Jack availability: Mon-Sat (1-6), 09:00-18:00, break 13:00-13:30
INSERT INTO staff_availability (staff_id, day_of_week, start_time, end_time, break_start, break_end) VALUES
  ((SELECT id FROM staff WHERE name = 'Jack'), 1, '09:00', '18:00', '13:00', '13:30'),
  ((SELECT id FROM staff WHERE name = 'Jack'), 2, '09:00', '18:00', '13:00', '13:30'),
  ((SELECT id FROM staff WHERE name = 'Jack'), 3, '09:00', '18:00', '13:00', '13:30'),
  ((SELECT id FROM staff WHERE name = 'Jack'), 4, '09:00', '18:00', '13:00', '13:30'),
  ((SELECT id FROM staff WHERE name = 'Jack'), 5, '09:00', '18:00', '13:00', '13:30'),
  ((SELECT id FROM staff WHERE name = 'Jack'), 6, '09:00', '18:00', '13:00', '13:30');

-- Jaden availability: Mon-Sat (1-6), 09:00-18:00, break 13:00-13:30
INSERT INTO staff_availability (staff_id, day_of_week, start_time, end_time, break_start, break_end) VALUES
  ((SELECT id FROM staff WHERE name = 'Jaden'), 1, '09:00', '18:00', '13:00', '13:30'),
  ((SELECT id FROM staff WHERE name = 'Jaden'), 2, '09:00', '18:00', '13:00', '13:30'),
  ((SELECT id FROM staff WHERE name = 'Jaden'), 3, '09:00', '18:00', '13:00', '13:30'),
  ((SELECT id FROM staff WHERE name = 'Jaden'), 4, '09:00', '18:00', '13:00', '13:30'),
  ((SELECT id FROM staff WHERE name = 'Jaden'), 5, '09:00', '18:00', '13:00', '13:30'),
  ((SELECT id FROM staff WHERE name = 'Jaden'), 6, '09:00', '18:00', '13:00', '13:30');
