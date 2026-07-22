function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

async function sendEmail({ to, subject, html, replyTo }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESET_FROM_EMAIL || 'RESET MCR <onboarding@resend.dev>';
  if (!key) return { configured: false };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html, reply_to: replyTo })
  });
  if (!response.ok) throw new Error(await response.text());
  return { configured: true, data: await response.json() };
}

function ownerEmail() {
  return process.env.RESET_NOTIFICATION_EMAIL || process.env.LEADS_TO_EMAIL || 'hello@resetmcr.com';
}

function leadHtml(data, title) {
  const rows = Object.entries(data).map(([key, value]) => `<tr><th align="left" style="padding:8px;border-bottom:1px solid #eee;text-transform:capitalize">${escapeHtml(key)}</th><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(value)}</td></tr>`).join('');
  return `<div style="font-family:Arial,sans-serif;color:#111"><h1>${escapeHtml(title)}</h1><table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;max-width:680px">${rows}</table><p style="color:#666">Source: resetmcr.com</p></div>`;
}

module.exports = { json, escapeHtml, sendEmail, ownerEmail, leadHtml };
