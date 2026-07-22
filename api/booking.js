const { json, escapeHtml, sendEmail, ownerEmail, leadHtml } = require('./_mail');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  try {
    const data = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!data.name || !data.email) return json(res, 400, { error: 'Name and email are required' });

    const owner = await sendEmail({
      to: ownerEmail(),
      subject: `RESET MCR booking interest — ${data.name}`,
      replyTo: data.email,
      html: leadHtml(data, 'New RESET MCR booking interest')
    });

    if (data.email && owner.configured) {
      await sendEmail({
        to: data.email,
        subject: 'You are on the RESET MCR early access list',
        html: `<div style="font-family:Arial,sans-serif;color:#111"><h1>RESET MCR</h1><p>Thanks ${escapeHtml(data.name)} — your request has landed.</p><p>We’ll be in touch with launch updates, early booking slots and founder offers as soon as they open.</p><p><strong>Recover. Reset. Perform.</strong></p></div>`
      });
    }

    return json(res, 200, { ok: true, emailConfigured: owner.configured });
  } catch (error) {
    return json(res, 500, { error: 'Unable to process booking request' });
  }
};
