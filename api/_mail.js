// RESET MCR — Zoho Mail helper (nodemailer, created per-request on Vercel)
const nodemailer = require('nodemailer');

const ZOHO_EMAIL    = process.env.ZOHO_EMAIL    || 'info@brightstacklabs.co.uk';
const ZOHO_PASSWORD = process.env.ZOHO_APP_PASSWORD || process.env.ZOHO_PASSWORD || '';
const EMAIL_FROM    = process.env.EMAIL_FROM    || `RESET MCR <${ZOHO_EMAIL}>`;
const EMAIL_TO      = process.env.EMAIL_TO      || 'malesy@yahoo.com';

function createTransporter() {
  if (!ZOHO_PASSWORD) {
    throw new Error('ZOHO_APP_PASSWORD / ZOHO_PASSWORD env var not set');
  }
  return nodemailer.createTransport({
    host:   process.env.ZOHO_SMTP_HOST || 'smtp.zoho.eu',
    port:   Number(process.env.ZOHO_SMTP_PORT || 465),
    secure: String(process.env.ZOHO_SMTP_PORT || '465') === '465',
    auth:   { user: ZOHO_EMAIL, pass: ZOHO_PASSWORD },
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function sendEmail({ to, subject, html, replyTo }) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from:    EMAIL_FROM,
    to,
    replyTo: replyTo || to,
    subject,
    html,
  });
}

function json(res, status, data) {
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = status;
  res.end(JSON.stringify(data));
}

module.exports = { json, escapeHtml, sendEmail, EMAIL_TO, EMAIL_FROM };
