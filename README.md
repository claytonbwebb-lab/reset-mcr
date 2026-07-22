# RESET MCR

Premium launch website for RESET MCR — a Stalybridge barbershop and recovery centre.

## Built in

- SEO landing page targeting Stalybridge / Manchester barber and recovery searches
- Mobile-first booking/waitlist form
- Vercel serverless API endpoints:
  - `/api/booking` — booking / launch access requests
  - `/api/lead` — simple CRM lead capture endpoint
- Automated email support via Resend when production environment variables are added
- Local business schema, sitemap, robots.txt and social preview metadata

## Vercel environment variables

Add these in Vercel once the production email/domain is ready:

```bash
RESEND_API_KEY=...
RESET_FROM_EMAIL="RESET MCR <hello@resetmcr.com>"
RESET_NOTIFICATION_EMAIL="hello@resetmcr.com"
```

Until `RESEND_API_KEY` is configured, the form still accepts submissions and returns a success state with `emailConfigured:false`, so the site can be previewed safely without sending email.

## Suggested next production integrations

- Connect the main booking CTA to Fresha, Booksy, Square Appointments or Cal.com once the operator chooses a booking platform.
- Connect `/api/booking` to HubSpot, Airtable or GoHighLevel if Danny wants a full CRM pipeline rather than email-led capture.
- Add real photography once the railway arch fit-out is complete.
