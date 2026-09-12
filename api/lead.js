const { json } = require('./_mail');

const VPS_EMAIL_URL = 'http://13.49.47.171/api/resetmcr/lead-email';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const data = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!data.email) return json(res, 400, { error: 'Email is required' });

    let emailConfigured = false;
    try {
      const response = await fetch(VPS_EMAIL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await response.json().catch(() => ({}));
      emailConfigured = result.ok || false;
    } catch (e) {
      console.error('Lead email proxy failed:', e.message);
    }

    return json(res, 200, { ok: true, emailConfigured });
  } catch (error) {
    return json(res, 500, { error: 'Unable to process lead' });
  }
};
