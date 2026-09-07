# RESET MCR

Premium barbershop website for Reset MCR — located under the railway arches in Stalybridge.

## Built with

- Static HTML/CSS/JS frontend (no framework)
- Vercel serverless API for booking, availability, diary, attendance
- Supabase database (PostgreSQL)
- Resend for transactional email

## Setup

### 1. Database setup

Run the SQL files in your Supabase project SQL editor:

```
api/schema.sql   — creates all tables
api/seed.sql    — seeds services, staff, and availability
```

### 2. Environment variables

Set these in your Vercel project dashboard:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `https://suyrbsuuckcvhdvxcvsf.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `RESEND_API_KEY` | Your Resend API key |
| `DIARY_PASSWORD` | Password for Jack's diary (e.g. `reset2026`) |
| `JACK_EMAIL` | Email for booking notifications (e.g. `hello@resetmcr.com`) |

### 3. Deploy

```bash
npx vercel --prod --yes --project reset-mcr --token YOUR_TOKEN
```

## Key pages

| Page | Description |
|---|---|
| `/` | Main site with booking flow |
| `/diary.html` | Jack's diary (password protected) |

## API endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/booking` | POST | Create a booking + send emails |
| `/api/availability` | GET | Get available slots (query: date, staff_id, service_id) |
| `/api/diary` | GET | Diary view (query: date, view=daily\|weekly) |
| `/api/attendance` | POST | Mark attended/no-show/cancelled |
| `/api/walkin` | POST | Add a walk-in |
| `/api/admin` | POST | Admin actions (move, block, unblock, timeoff) |
