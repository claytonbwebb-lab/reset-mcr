const { json, escapeHtml, sendEmail, EMAIL_TO } = require('./_mail');

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

  if (!email) {
    return json(res, 400, { error: 'Email is required' });
  }

  const safe = {
    name: escapeHtml(name || 'Not provided'),
    email: escapeHtml(email),
    phone: escapeHtml(phone || 'Not provided'),
    service: escapeHtml(service || 'Not specified'),
    message: escapeHtml(message || 'No message'),
  };

  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#111;color:#f0ece4;padding:24px;border-radius:4px;border:1px solid #2a2520">
    <h2 style="color:#d4c4a8;font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #2a2520;padding-bottom:12px;margin-top:0">New RESET MCR Lead</h2>
    <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;margin-top:16px">
      <tr><th align="left" style="padding:8px;border-bottom:1px solid #2a2520;color:#d4c4a8;text-transform:capitalize;font-family:Oswald,sans-serif;">Name</th><td style="padding:8px;border-bottom:1px solid #2a2520;color:#f0ece4;">${safe.name}</td></tr>
      <tr><th align="left" style="padding:8px;border-bottom:1px solid #2a2520;color:#d4c4a8;text-transform:capitalize;font-family:Oswald,sans-serif;">Email</th><td style="padding:8px;border-bottom:1px solid #2a2520;color:#f0ece4;"><a href="mailto:${safe.email}" style="color:#d4c4a8">${safe.email}</a></td></tr>
      <tr><th align="left" style="padding:8px;border-bottom:1px solid #2a2520;color:#d4c4a8;text-transform:capitalize;font-family:Oswald,sans-serif;">Phone</th><td style="padding:8px;border-bottom:1px solid #2a2520;color:#f0ece4;">${safe.phone}</td></tr>
      <tr><th align="left" style="padding:8px;border-bottom:1px solid #2a2520;color:#d4c4a8;text-transform:capitalize;font-family:Oswald,sans-serif;">Service</th><td style="padding:8px;border-bottom:1px solid #2a2520;color:#f0ece4;">${safe.service}</td></tr>
      <tr><th align="left" style="padding:8px;border-bottom:1px solid #2a2520;color:#d4c4a8;text-transform:capitalize;font-family:Oswald,sans-serif;">Message</th><td style="padding:8px;border-bottom:1px solid #2a2520;color:#f0ece4;">${safe.message}</td></tr>
    </table>
    <p style="margin-top:20px;font-size:11px;color:#666;">Source: resetmcr.com enquiry form</p>
  </div>`;

  try {
    await sendEmail({
      to: EMAIL_TO,
      subject: `RESET MCR lead — ${safe.email}`,
      replyTo: safe.email,
      html,
    });
    return json(res, 200, { ok: true });
  } catch (err) {
    console.error('lead error:', err);
    return json(res, 500, { error: 'Unable to process lead' });
  }
};
