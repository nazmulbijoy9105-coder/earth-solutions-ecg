const persistence = require('../../lib/persistence.cjs');
const database = require('../../lib/db.cjs');

const validUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
const validGuestId = value => typeof value === 'string' && /^anon_[A-Za-z0-9_-]{16,100}$/.test(value);

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  const body = req.body || {};
  if (!validGuestId(body.userId) || !validUuid(body.conversationId)) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: 'Invalid conversation identity' }));
  }
  if (!database.isDatabaseConfigured()) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ error: 'Conversation storage is not configured' }));
  }

  try {
    const messages = await persistence.getConversationMessages(body.conversationId, body.userId, 50);
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ messages }));
  } catch {
    res.statusCode = 503;
    return res.end(JSON.stringify({ error: 'Conversation history unavailable' }));
  }
}
