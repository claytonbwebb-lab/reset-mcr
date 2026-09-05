const { json, escapeHtml, sendEmail, EMAIL_TO, EMAIL_FROM } = require('./_mail');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  let data;
  try {
    data = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch {
    return json(res, 400, { error: 'Invalid JSON body' });
  }

  const { name, email, phone, service, message } = data;

  if (!name || !email) {
    return json(res, 400, { error: 'Name and email are required' });
  }

  const safe = {
    name: escapeHtml(name),
    email: escapeHtml(email),
    phone: escapeHtml(phone || 'Not provided'),
    service: escapeHtml(service || 'Not specified'),
    message: escapeHtml(message || 'No message'),
  };

  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#111;color:#f0ece4;padding:24px;border-radius:4px;border:1px solid #2a2520">
    <h2 style="color:#d4c4a8;font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #2a2520;padding-bottom:12px;margin-top:0">New RESET MCR Booking Interest</h2>
    <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;margin-top:16px">
      <tr><th align="left" style="padding:8px;border-bottom:1px solid #2a2520;color:#d4c4a8;text-transform:capitalize;font-family:Oswald,sans-serif;">Name</th><td style="padding:8px;border-bottom:1px solid #2a2520;color:#f0ece4;">${safe.name}</td></tr>
      <tr><th align="left" style="padding:8px;border-bottom:1px solid #2a2520;color:#d4c4a8;text-transform:capitalize;font-family:Oswald,sans-serif;">Email</th><td style="padding:8px;border-bottom:1px solid #2a2520;color:#f0ece4;"><a href="mailto:${safe.email}" style="color:#d4c4a8">${safe.email}</a></td></tr>
      <tr><th align="left" style="padding:8px;border-bottom:1px solid #2a2520;color:#d4c4a8;text-transform:capitalize;font-family:Oswald,sans-serif;">Phone</th><td style="padding:8px;border-bottom:1px solid #2a2520;color:#f0ece4;">${safe.phone}</td></tr>
      <tr><th align="left" style="padding:8px;border-bottom:1px solid #2a2520;color:#d4c4a8;text-transform:capitalize;font-family:Oswald,sans-serif;">Service</th><td style="padding:8px;border-bottom:1px solid #2a2520;color:#f0ece4;">${safe.service}</td></tr>
      <tr><th align="left" style="padding:8px;border-bottom:1px solid #2a2520;color:#d4c4a8;text-transform:capitalize;font-family:Oswald,sans-serif;">Message</th><td style="padding:8px;border-bottom:1px solid #2a2520;color:#f0ece4;">${safe.message}</td></tr>
    </table>
    <p style="margin-top:20px;font-size:11px;color:#666;">Source: resetmcr.com booking form</p>
  </div>`;

  try {
    // Send to owner
    await sendEmail({
      to: EMAIL_TO,
      subject: `RESET MCR booking interest — ${safe.name}`,
      replyTo: safe.email,
      html,
    });

    // Auto-reply to submitter
    const autoReplyHtml = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#111;color:#f0ece4;padding:24px;border-radius:4px;border:1px solid #2a2520">
      <h2 style="color:#d4c4a8;font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #2a2520;padding-bottom:12px;margin-top:0">We received your request</h2>
      <p style="color:#f0ece4;line-height:1.6">Thanks ${safe.name},</p>
      <p style="color:#f0ece4;line-height:1.6">Your booking enquiry has landed. We'll be in touch shortly with available slots and early-access offers.</p>
      <p style="color:#d4c4a8;font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.05em;margin-top:24px"><strong>Recover. Reset. Perform.</strong></p>
    </div>`;

    await sendEmail({
      to: email,
      subject: 'RESET MCR — we received your booking enquiry',
      replyTo: EMAIL_TO,
      html: autoReplyHtml,
    });

    return json(res, 200, { ok: true });
  } catch (err) {
    console.error('booking error:', err);
    return json(res, 500, { error: 'Unable to process booking request' });
  }
};
