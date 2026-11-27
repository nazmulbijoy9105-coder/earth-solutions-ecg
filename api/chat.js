// Vercel chat function — uses the same PostgreSQL repositories as Express.
const { buildSystemPrompt, matchFAQ, getFallback } = require('../lib/ai-core.js');
const persistence = require('../lib/persistence.cjs');
const database = require('../lib/db.cjs');

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function validGuestId(value) {
  return typeof value === 'string' && /^anon_[A-Za-z0-9_-]{16,100}$/.test(value);
}

module.exports = async function handler(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;
  if (allowedOrigin && req.headers.origin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  let identity;
  try { identity = await resolveCustomerIdentity(req, res); }
  catch { res.statusCode = 401; return res.end(JSON.stringify({ error: 'Invalid or unavailable customer identity' })); }

  const body = req.body || {};
  const lang = body.lang === 'bn' ? 'bn' : 'en';
  const stageNum = Number(body.stage);
  const stage = Number.isInteger(stageNum) && stageNum >= 1 && stageNum <= 7 ? stageNum : null;
  const userId = identity.ownerId;
  const conversationId = body.conversationId;
  const messageId = body.messageId;
  const safeMessages = (Array.isArray(body.messages) ? body.messages : [])
    .filter(message => message && message.role === 'user' && typeof message.content === 'string')
    .slice(-20);
  const lastUser = safeMessages[safeMessages.length - 1];
  const lastUserText = String(lastUser?.content || '').slice(0, 4000);

  if (!Boolean(userId) || !validUuid(conversationId) || !validUuid(messageId) || !lastUserText.trim()) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'A valid guest id, conversation id, message id and message are required' }));
  }

  if (process.env.NODE_ENV === 'production' && !database.isDatabaseConfigured()) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Persistent conversation storage is required' }));
  }

  let previousMessages = [];
  let isFirstMessage = safeMessages.length === 1;
  if (database.isDatabaseConfigured()) {
    try {
      const rateLimit = await persistence.consumeChatRateLimit({ userId, ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress });
      if (!rateLimit.allowed) {
        res.statusCode = 429;
        res.setHeader('Retry-After', String(rateLimit.retryAfter));
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'Too many chat requests. Please wait before trying again.' }));
      }
      const ownedId = await persistence.getOrCreateConversation({
        conversationId, ...identity,
        ...identity,
        stage,
        lang,
      });
      previousMessages = await persistence.getConversationMessages(ownedId, identity.ownerId, 30);
      const dailyQuota = await persistence.appendUserMessageWithQuota({
        conversationId: ownedId,
        ...identity,
        messageId,
        content: lastUserText,
      });
      if (!dailyQuota.allowed) {
        const retryAt = new Date(dailyQuota.retryAt);
        res.setHeader('Retry-After', String(Math.max(1, Math.ceil((retryAt.getTime() - Date.now()) / 1000))));
        res.setHeader('X-Free-Quota-Limit', String(dailyQuota.limit));
        res.setHeader('X-Free-Quota-Reset', retryAt.toISOString());
        res.statusCode = 429;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'Daily free message limit reached. Please try again after the daily reset.' }));
      }
      if (dailyQuota.duplicate) {
        res.statusCode = 409;
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ error: 'This message was already submitted. Refresh conversation history before retrying.' }));
      }
      isFirstMessage = previousMessages.length === 0;
    } catch {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Persistent conversation storage is unavailable' }));
    }
  }

  const contextMessages = database.isDatabaseConfigured()
    ? [...previousMessages, { role: 'user', content: lastUserText }].slice(-30)
    : (Array.isArray(body.messages) ? body.messages : [])
        .filter(message => message && ['user', 'assistant'].includes(message.role) && typeof message.content === 'string')
        .slice(-20)
        .map(message => ({ role: message.role, content: message.content.slice(0, 4000) }));

  const FULL = process.env.USE_FULL_PROMPT === '1';
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Conversation-Id', conversationId);
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const send = obj => res.write('data: ' + JSON.stringify(obj) + '\n\n');
  const finish = () => { res.write('data: [DONE]\n\n'); res.end(); };
  const streamText = async (text, delayMs) => {
    for (const word of String(text).split(' ')) {
      send({ choices: [{ delta: { content: word + ' ' } }] });
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  };
  let inquiryLogged = false;

  try {
    if (FULL) {
      const faq = matchFAQ(lastUserText, lang);
      if (faq) {
        if (isFirstMessage && database.isDatabaseConfigured()) {
          await persistence.createInquiry({ ...identity, stage, lang, firstMessage: lastUserText, ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress, source: 'faq' });
          inquiryLogged = true;
        }
        if (database.isDatabaseConfigured()) {
          await persistence.appendConversationMessage({ conversationId, ...identity, role: 'assistant', content: faq, provider: 'faq' });
        }
        await streamText(faq, 18);
        return finish();
      }
    }

    if (!process.env.GROQ_API_KEY) throw new Error('AI provider is not configured');
    if (isFirstMessage && database.isDatabaseConfigured()) {
      await persistence.createInquiry({ userId, stage, lang, firstMessage: lastUserText, ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress, source: 'ai' });
      inquiryLogged = true;
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.GROQ_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'system', content: FULL ? buildSystemPrompt(stage, lang) : 'You are Peopole AI, an education guidance assistant. Do not invent current immigration rules, fees, deadlines, or visa outcomes. Identify uncertainty and refer users to official sources.' }, ...contextMessages],
        stream: true,
        temperature: FULL ? 0.65 : 0.7,
        max_tokens: 4096,
        ...(FULL ? { top_p: 0.9 } : {}),
      }),
    });
    if (!response.ok) throw new Error('AI provider returned HTTP ' + response.status);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullReply = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const parsed = JSON.parse(raw);
          fullReply += parsed.choices?.[0]?.delta?.content || '';
          res.write('data: ' + raw + '\n\n');
        } catch {}
      }
    }

    if (fullReply && database.isDatabaseConfigured()) {
      await persistence.appendConversationMessage({ conversationId, anonymousId: userId, role: 'assistant', content: fullReply, provider: 'groq', model: 'openai/gpt-oss-120b' });
    }
    return finish();
  } catch (error) {
    process.stderr.write('[Peopole AI Vercel] request failed: ' + String(error.message || 'unknown error') + '\n');
    const fallback = getFallback(lang);
    if (isFirstMessage && !inquiryLogged && database.isDatabaseConfigured()) {
      try {
        await persistence.createInquiry({ userId, stage, lang, firstMessage: lastUserText, ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress, source: 'fallback' });
      } catch {}
    }
    if (database.isDatabaseConfigured()) {
      try {
        await persistence.appendConversationMessage({ conversationId, anonymousId: userId, role: 'assistant', content: fallback, provider: 'fallback' });
      } catch {}
    }
    try {
      await streamText(fallback, 20);
      return finish();
    } catch {
      return res.end();
    }
  }
}
