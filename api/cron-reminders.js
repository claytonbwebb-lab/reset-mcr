import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VPS_EMAIL_URL = 'http://13.49.47.171/api/resetmcr/reminder-email';

function isCronAuthorised(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const headerSecret = req.headers['x-cron-secret'];
  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return headerSecret === secret || bearer === secret;
}

function ukDateParts(daysFromNow = 0) {
  const now = new Date();
  const target = new Date(now.getTime() + daysFromNow * 86400000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(target).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function ukLocalToUtcIso(dateStr) {
  const asUtc = new Date(dateStr);
  const year = asUtc.getUTCFullYear();
  const march31 = new Date(Date.UTC(year, 2, 31));
  const bstStart = new Date(Date.UTC(year, 2, 31 - march31.getUTCDay(), 1, 0, 0));
  const oct31 = new Date(Date.UTC(year, 9, 31));
  const bstEnd = new Date(Date.UTC(year, 9, 31 - oct31.getUTCDay(), 1, 0, 0));
  const offsetMs = (asUtc >= bstStart && asUtc < bstEnd) ? 3600000 : 0;
  return new Date(asUtc.getTime() - offsetMs).toISOString();
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Europe/London'
  });
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'Europe/London'
  });
}

export default async function handler(req, res) {
  if (!isCronAuthorised(req)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const tomorrow = ukDateParts(1);
    const startUtc = ukLocalToUtcIso(`${tomorrow}T00:00:00`);
    const endUtc = ukLocalToUtcIso(`${tomorrow}T23:59:59.999`);

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        id, start_datetime, is_recurring, recurring_interval, reminder_24h_sent_at,
        customer:customer_id(name, email),
        staff:staff_id(name),
        service:service_id(name)
      `)
      .eq('status', 'confirmed')
      .is('reminder_24h_sent_at', null)
      .gte('start_datetime', startUtc)
      .lte('start_datetime', endUtc)
      .order('start_datetime', { ascending: true });

    if (error) throw error;

    let sent = 0;
    let skipped = 0;
    const failures = [];

    for (const booking of bookings || []) {
      if (!booking.customer?.email) {
        skipped++;
        continue;
      }
      const payload = {
        customerEmail: booking.customer.email,
        customerName: booking.customer.name,
        barberName: booking.staff?.name || 'your barber',
        serviceName: booking.service?.name || 'your appointment',
        date: formatDate(booking.start_datetime),
        time: formatTime(booking.start_datetime),
        cancelLink: `https://resetmcr.com/?cancel=${booking.id}&email=${encodeURIComponent(booking.customer.email)}`,
        isRecurring: !!booking.is_recurring,
        recurringInterval: booking.recurring_interval || null
      };

      try {
        const response = await fetch(VPS_EMAIL_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(await response.text());
        await supabase
          .from('bookings')
          .update({ reminder_24h_sent_at: new Date().toISOString() })
          .eq('id', booking.id);
        sent++;
      } catch (e) {
        failures.push({ booking_id: booking.id, error: e.message });
      }
    }

    return res.status(failures.length ? 207 : 200).json({
      success: failures.length === 0,
      date: tomorrow,
      found: bookings?.length || 0,
      sent,
      skipped,
      failures
    });
  } catch (err) {
    console.error('Reminder cron error:', err);
    return res.status(500).json({ error: 'Failed', details: err.message });
  }
}
