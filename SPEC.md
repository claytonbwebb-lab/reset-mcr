# SPEC.md — Reset MCR Rebrand + Booking System

## Context

Reset MCR is pivoting from a barbershop + recovery centre to **barbershop only**. The existing site at `clients/danny-taylor/reset-mcr/` is a Vercel static site (HTML/CSS/JS, no framework). This spec covers two deliverables:

1. **Rebrand**: Strip all recovery content, rebuild as a pure barbershop site
2. **Booking system**: Full customer-facing booking + staff diary, per Danny's spec

Danny's confirmed requirements are in `SPEC_SOURCE.md` (sourced from the Word doc attached to the brief). Danny's red-line feedback is incorporated throughout.

---

## Project Location
`/home/ubuntu/.openclaw/workspace/clients/danny-taylor/reset-mcr/`

---

## DELIVERABLE 1 — Rebrand to Barbershop Only

### Remove
- `#recovery` section (full section with 4-panel visual, copy about contrast therapy, sauna, cold plunge, etc.)
- `#services` — keep only "Barbering" card; remove Sauna, Cold Plunge, Steam, Compression, Red Light
- `service-sauna`, `service-cold`, `service-steam`, `service-compression`, `service-red` CSS classes and images
- Recovery photos (`photo-service-02-sauna-heat.jpg` through `photo-service-06-red-light.jpg` — keep `photo-service-01-barbering.jpg`)
- Recovery SVG icons (`recovery-cold-plunge.svg`, `recovery-infrared-sauna.svg`, `recovery-red-light.svg`, `recovery-steam-hot-tub.svg`)
- `service-cold-plunge.svg`, `service-sauna.svg`, `service-red.svg`, `service-steam.svg`, `service-compression.svg`, `service-cold-plunge.svg`
- Blog posts about recovery (`benefits-of-cold-plunge.html`, `sauna-heat-and-reset.html`) — keep `barber-and-recovery-routine.html` (rename/repurpose if needed)
- Any recovery references in meta tags, schema, footer links

### Update
- `<title>`: "RESET MCR | Barbershop in Stalybridge" (remove "Recovery Centre")
- Meta description: barbershop-focused
- Schema: `@type: BarberShop` not `HealthAndBeautyBusiness`
- Hero copy: remove recovery mention; lead with barbershop positioning
- Nav: remove `#recovery` link
- `#services` section: single Barbering card (full width or large feature)
- `#barber` section: expand into main landing content — positioning, what to expect, atmosphere
- `#membership` / `#offers` section: replace with simple pricing menu — Haircut £X, Hair + Beard £Y, Kids Cut £Z, Skin Fade £A, Cut-throat shave £B etc. No membership/launch offer framing — just a clean price list with a "Book" CTA
- Local presence section: update keywords to barber/fade/stalybridge only
- Footer: update nav links; remove recovery references
- OG description and any hard-coded copy referencing recovery

### Add
- A **"Meet the Team"** section with Jack and Jaden (Jaden is the apprentice) — name, role, bio blurb. Place near the top of the barber section or as a new section
- Photos: if `photo-barbershop.jpg` is the interior, we may need headshot-style photos for Jack and Jaden. Use placeholder divs with name overlay if no photos yet (clearly marked)
- A **"How it works"** or steps section for the booking flow (3 steps: Choose service → Pick a time → Confirm)
- Location details: Stalybridge under the railway arches — make this prominent

### Design
- Keep existing CSS design language (dark, gold accent, Oswald/Inter fonts, dark luxury feel)
- Service card grid: single wide card or two-column layout for the barbering card
- Clean, minimal — this is a premium barbershop
- Keep `styles.css` and `script.js` structure; add new CSS only

---

## DELIVERABLE 2 — Booking System

### Architecture
- Single-page booking UI embedded in `#book` section of `index.html` (NOT a separate page — inline expand or replace the current waitlist form)
- Backend: Vercel serverless functions in `api/` directory
  - `api/booking.js` — POST: create booking, send emails
  - `api/availability.js` — GET: return available slots for a given date/staff/service
  - `api/diary.js` — GET: staff diary (Jack only sees all; other staff see theirs)
  - `api/walkin.js` — POST: add walk-in manually (Jack/admin)
  - `api/attendance.js` — POST: mark appointment attended/no-show/cancelled
  - `api/admin.js` — POST: admin actions (move booking, change staff, block/unblock customer)
- Database: Supabase (PPW account — Supabase URL and service role key in Vercel env vars)
- Email: Resend (API key in Vercel env vars)

### Database Schema

```sql
-- Services
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,          -- e.g. "Haircut", "Hair + Beard"
  price_pence INT NOT NULL,    -- stored but NOT shown to customers
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Staff
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,          -- "Jack", "Jaden"
  role TEXT NOT NULL,          -- "Senior Barber", "Apprentice"
  bio TEXT,
  photo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Service durations per staff member
CREATE TABLE staff_service_durations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES staff(id),
  service_id UUID REFERENCES services(id),
  duration_mins INT NOT NULL,
  UNIQUE(staff_id, service_id)
);

-- Working patterns (recurring weekly availability)
CREATE TABLE staff_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES staff(id),
  day_of_week INT NOT NULL,   -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL,    -- e.g. "09:00"
  end_time TIME NOT NULL,      -- e.g. "18:00"
  break_start TIME,            -- e.g. "13:00"
  break_end TIME               -- e.g. "13:30"
);

-- One-off unavailable periods (holidays, sick days)
CREATE TABLE staff_unavailable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES staff(id),
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ NOT NULL,
  reason TEXT
);

-- Customers
CREATE TABLE customers (
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

-- Bookings
CREATE TABLE bookings (
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
```

### Seed Data (required)
Services:
- Haircut — Jack: 30 mins, Jaden: 60 mins
- Hair + Beard — Jack: 45 mins, Jaden: 80 mins
- Beard Only — Jack: 20 mins, Jaden: 30 mins
- Kids Cut — Jack: 20 mins, Jaden: 40 mins
- Cut-Throat Shave — Jack: 30 mins, Jaden: 45 mins
- Haircut + Cut-Throat Shave — Jack: 60 mins, Jaden: 80 mins

Staff:
- Jack — Senior Barber, bio, photo (placeholder if none)
- Jaden — Apprentice, bio, photo (placeholder if none)

Default availability: Mon–Sat 09:00–18:00, break 13:00–13:30 (same for both).

### Customer Booking Flow (UI)

1. **Step 1 — Service**: Grid of service cards (no prices shown). Select one.
2. **Step 2 — Staff**: Show Jack and Jaden with photo, name, role. "Any Available" option also shown. If "Any Available", system picks first available slot across both staff.
3. **Step 3 — Date & Time**: Calendar date picker → fetch available slots via `api/availability`. Show only genuinely available slots. Show the duration for selected service+staff.
4. **Step 4 — Your Details**: Name, mobile, email. First-time customers: "Would you like to make this a recurring booking?" with options Weekly / Fortnightly / Monthly. Returning customers: checkbox "Make this a recurring booking" with same interval options (shown after first booking or when ticking).
5. **Step 5 — Confirm**: Summary. "Book" button. On submit → POST to `api/booking`.
6. **Confirmation**: Inline confirmation on page. Email sent immediately via Resend. Show: date, time, service, staff member, "Under the railway arches, Stalybridge" as location. Include cancel/reschedule link (valid up to 30 mins before appointment).
7. **Recurring note**: If recurring, the system should schedule the next occurrence in 1/2/4 weeks automatically, up to 4 weeks ahead max for customer bookings.

### Cancellation / Rescheduling
- Link in confirmation email: `resetmcr.com/?cancel=[booking_id]&email=[customer_email]`
- Landing page: shows booking details, "Cancel" and "Reschedule" options
- Cancellation: marks booking cancelled, sends email to both customer and Jack
- Reschedule: returns to step 3 with current booking data pre-filled
- Cutoff: no cancellation/reschedule less than 30 minutes before appointment
- On cancellation: record reason (optional free text)

### Reminders
- On booking: immediate confirmation email
- 24 hours before: automated reminder email
- 1 hour before: second reminder email (per Danny's confirmation)
- Reminders must include cancel/reschedule link

### Staff Diary (Jack's View)
- Route: `/diary` (or query param to show diary view within site)
- Simple auth: hardcoded password in env var (or single shared password) — this is v1
- Views: Daily (default) + Weekly
- Weekly view: capacity % shown (e.g. "65% booked this week")
- Each booking card: customer name, time, service, staff member, duration, status
- One-tap status update: attended / no-show / cancelled (bottom of each card)
- "Add walk-in" button: opens form for manual walk-in booking

### New Booking Notifications
- Jack receives email on every new booking via `hello@resetmcr.com`
- Notification shows: customer name, service, date, time, staff member

### Three No-Show Rule
- Track `consecutive_no_shows` on customer record
- On no-show: increment `consecutive_no_shows`, reset to 0 on attended
- After 3 consecutive no-shows: block customer
- Blocked customers see: "Online booking unavailable — please contact Reset MCR directly to reset this."
- Jack can manually unblock via admin panel

### Admin Panel
- Simple HTML page behind auth
- Jack can: add/edit booking, move booking, cancel, change staff, change service, block/unblock customer, add time-off for staff
- No full CRUD UI needed for services/staff in v1 — seed data is sufficient

### API Endpoints Detail

**POST /api/booking**
- Body: `{ service_id, staff_id, start_datetime, customer_name, customer_email, customer_mobile, is_recurring, recurring_interval }`
- Returns: `{ booking_id, success }`
- Side effects: insert booking, insert customer if new, send customer confirmation email, send Jack notification email

**GET /api/availability?date=YYYY-MM-DD&staff_id=uuid&service_id=uuid**
- Returns: `{ slots: [{ time: "HH:MM", staff_id, duration_mins }] }`
- Computes available 30-min increment slots for that day, excluding booked slots and staff breaks/unavailability

**GET /api/diary?staff_id=uuid&date=YYYY-MM-DD&view=daily|weekly**
- Returns: `{ bookings: [{ id, customer_name, service_name, staff_name, start, end, status }] }`
- Jack's staff_id omitted = all bookings

**POST /api/attendance**
- Body: `{ booking_id, status: "attended"|"no_show"|"cancelled", cancellation_reason? }`
- Updates booking status; updates customer consecutive_no_show count

**POST /api/admin**
- Body: `{ action: "move"|"add"|"block"|"unblock"|"timeoff", ...params }`
- Admin-only

**POST /api/walkin**
- Body: `{ service_id, staff_id, start_datetime, customer_name, customer_mobile }`
- Same as booking but `source = 'walk_in'` and no confirmation email to customer

### Email Templates (Resend)
- **Confirmation**: "Your booking at Reset MCR" — date, time, service, staff, location, cancel link
- **Reminder (24h)**: "Reminder: your appointment tomorrow at Reset MCR" — same details + cancel/reschedule
- **Reminder (1h)**: "Appointment in 1 hour at Reset MCR" — same + cancel link
- **Cancellation (customer)**: "Booking cancelled — Reset MCR"
- **Cancellation (Jack notification)**: "Booking cancelled — Reset MCR" — who cancelled, reason if given
- **New booking (Jack)**: "New booking — Reset MCR" — customer, service, date, time, staff
- All emails from: `hello@resetmcr.com`

### Booking Rules
- Customers can book up to 4 weeks ahead
- Recurring bookings: carry on up to 4 weeks ahead
- Same-day bookings: allowed if slots available
- Minimum notice: none (walk-ins handled manually)
- Multiple future bookings per customer: allowed
- Blocked detection: by email AND mobile (check both on booking)

---

## Process Notes

1. Set up Supabase tables first (run SQL directly via Supabase dashboard or `psql`)
2. Seed the database with services and staff data
3. Build the booking UI step-by-step in `index.html`
4. Build API endpoints in `api/`
5. Wire up Resend for emails
6. Build the diary view
7. Test end-to-end before deploying
8. Vercel env vars needed:
   - `SUPABASE_URL` — `https://suyrbsuuckcvhdvxcvsf.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` — service role key from TOOLS.md
   - `RESEND_API_KEY` — Resend API key (from Resend dashboard)
   - `DIARY_PASSWORD` — simple shared password for Jack's diary access
   - `JACK_EMAIL` — where Jack gets notifications (confirm with Steve/Danny)
9. After deploy: verify at resetmcr.com — check title, no recovery content, booking flow works
