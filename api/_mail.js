// ── RESET MCR — Shared mail helpers (Resend API) ───────────────────────────────
const { json, escapeHtml } = require('./_utils')

const RESEND_KEY  = process.env.RESEND_API_KEY  || ''
const EMAIL_FROM  = process.env.EMAIL_FROM  || 'RESET MCR <onboarding@resend.dev>'
const EMAIL_TO    = process.env.EMAIL_TO    || 'malesy@yahoo.com'

// ── Email sender ─────────────────────────────────────────────────────────────
async function sendEmail({ to, subject, html, replyTo }) {
  if (!RESEND_KEY) {
    console.warn('[_mail] Resend API key not set — RESEND_API_KEY env var missing')
    return { configured: false }
  }
  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ from: EMAIL_FROM, to, subject, html, reply_to: replyTo }),
  })
  if (!res.ok) {
    const text = await res.text()
    console.error('[_mail] Resend error:', res.status, text)
    throw new Error(`Resend ${res.status}: ${text}`)
  }
  const data = await res.json()
  console.info('[_mail] Sent:', data.id)
  return { configured: true, data }
}

// ── Shared HTML builder ───────────────────────────────────────────────────────
function leadHtml(data, title) {
  const rows = Object.entries(data)
    .map(([key, value]) => `<tr><th align="left" style="padding:8px;border-bottom:1px solid #333;color:#d4c4a8;text-transform:capitalize;font-family:Oswald,sans-serif;">${escapeHtml(key)}</th><td style="padding:8px;border-bottom:1px solid #333;color:#f0ece4;">${escapeHtml(value)}</td></tr>`)
    .join('')
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><style>body{background:#070707;color:#f0ece4;font-family:Arial,sans-serif;margin:0;padding:0}</style></head>
<body style="background:#070707;color:#f0ece4;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;background:#111;border-radius:4px;border:1px solid #2a2520;">
    <h2 style="color:#d4c4a8;font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #2a2520;padding-bottom:12px;">${escapeHtml(title)}</h2>
    <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;margin-top:16px;">${rows}</table>
    <p style="margin-top:20px;font-size:11px;color:#666;">Source: resetmcr.com</p>
  </div>
</body>
</html>`
}

module.exports = { json, escapeHtml, sendEmail, leadHtml }
