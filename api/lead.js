const { json, sendEmail, ownerEmail, leadHtml } = require('./_mail');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const data = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!data.email) return json(res, 400, { error: 'Email is required' });
    const result = await sendEmail({
      to: ownerEmail(),
      subject: `RESET MCR lead — ${data.email}`,
      replyTo: data.email,
      html: leadHtml(data, 'New RESET MCR lead')
    });
    return json(res, 200, { ok: true, emailConfigured: result.configured });
  } catch (error) {
    return json(res, 500, { error: 'Unable to process lead' });
  }
};
