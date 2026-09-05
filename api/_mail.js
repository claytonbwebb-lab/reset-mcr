const nodemailer = require('nodemailer')

// ── Config (set via Vercel environment variables) ─────────────────────────
const ZOHO_EMAIL    = process.env.ZOHO_EMAIL    || 'info@brightstacklabs.co.uk'
const ZOHO_PASSWORD = process.env.ZOHO_PASSWORD || ''
const EMAIL_FROM    = process.env.EMAIL_FROM    || 'RESET MCR <info@brightstacklabs.co.uk>'
const EMAIL_TO      = process.env.EMAIL_TO      || 'malesy@yahoo.com'

// ── Transporter (created once at cold-start) ────────────────────────────────
let transporter
if (ZOHO_PASSWORD) {
  transporter = nodemailer.createTransport({
    host: 'smtp.zoho.eu',
    port: 465,
    secure: true,
    auth: {
      user: ZOHO_EMAIL,
      pass: ZOHO_PASSWORD,
    },
  })
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function json(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]))
}

// ── Email sender ─────────────────────────────────────────────────────────────
async function sendEmail({ to, subject, html, replyTo }) {
  if (!transporter) {
    console.warn('[_mail] SMTP not configured — ZOHO_PASSWORD not set')
    return { configured: false }
  }
  try {
    const info = await transporter.sendMail({ from: EMAIL_FROM, to, subject, html, replyTo })
    console.info('[_mail] Sent:', info.response)
    return { configured: true, info }
  } catch (err) {
    console.error('[_mail] Send error:', err.message)
    throw err
  }
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
