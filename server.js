// ═══════════════════════════════════════════════════════════════════════════
// server.js — Peopole AI v8.0 | Earth Solutions Visa Zone
// ─────────────────────────────────────────────────────────────────────────
//  1. Server-side FAQ  → instant SSE reply (zero AI cost)
//  2. Groq LLaMA 70B   → stage-specific professional prompt + SSE stream
//  3. Fallback pool    → always responds even if Groq is down
//  4. Session store    → in-memory keyed by userId (swap Map→DB to scale)
//  5. Push Notifications → Web Push via VAPID (subscribe / send endpoints)
//  6. Analytics        → built-in pageview + event tracking (no 3rd party)
//  7. Admin dashboard  → auth, stats, inquiries, push, reset
// ═══════════════════════════════════════════════════════════════════════════
'use strict';

const express   = require('express');
const path      = require('path');
const webpush   = require('web-push');
const proxyNeonAuth = require('./lib/auth-proxy.cjs');
const { requireNeonAuth, requireAppAdmin } = require('./lib/neon-auth.cjs');

const app  = express();

// P0-07 security hardening
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 300;
const rateLimitBuckets = new Map();

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }

  next();
}

function requestRateLimit(req, res, next) {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

  const now = Date.now();
  let bucket = rateLimitBuckets.get(clientIp);

  if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    bucket = {
      windowStart: now,
      count: 0
    };
  }

  bucket.count += 1;
  rateLimitBuckets.set(clientIp, bucket);

  if (bucket.count > RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.max(
      1,
      Math.ceil((RATE_LIMIT_WINDOW_MS - (now - bucket.windowStart)) / 1000)
    );

    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: 'Too many requests. Please try again later.'
    });
  }

  next();
}

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(securityHeaders);
app.use('/api', requestRateLimit);
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));

// ─────────────────────────────────────────────────────────────────────────
// A. VAPID — Web Push configuration
//    Set VAPID_PUBLIC / VAPID_PRIVATE env vars (generate once with web-push)
//    Run once to generate:  npx web-push generate-vapid-keys
// ─────────────────────────────────────────────────────────────────────────
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC  || 'REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE || 'REPLACE_WITH_YOUR_VAPID_PRIVATE_KEY';
const VAPID_EMAIL   = process.env.VAPID_EMAIL   || 'mailto:admin@earthsolutions.com.bd';

try {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
} catch (e) {
  console.warn('[Push] VAPID not configured — push notifications disabled:', e.message);
}

// ─────────────────────────────────────────────────────────────────────────
// B. DURABLE PERSISTENCE — Neon PostgreSQL
const persistence = require('./lib/persistence.cjs');
const { isDatabaseConfigured, healthCheck: databaseHealthCheck, closePool } = require('./lib/db.cjs');

async function logInquiry(input) {
  if (!isDatabaseConfigured()) return false;
  await persistence.createInquiry(input);
  return true;
}

// Analytics is best-effort for public page loads; durable records are written
// only when DATABASE_URL is configured. Health checks expose missing storage.
async function logPageview(pagePath, referrer, userId) {
  if (!isDatabaseConfigured()) return false;
  await persistence.logPageview(pagePath, referrer, { userId });
  return true;
}
async function logEvent(name, meta, userId) {
  if (!isDatabaseConfigured()) return false;
  await persistence.logEvent(name, meta, { userId });
  return true;
}

// ─────────────────────────────────────────────────────────────────────────
// D. Chat history and session state are stored in Neon PostgreSQL.

// E. SERVER-SIDE FAQ DATABASE — instant answers, zero Groq cost
// ─────────────────────────────────────────────────────────────────────────
// AI core (FAQs, stage prompts, fallbacks) lives in lib/ai-core.js, shared with api/chat.js
const { SERVER_FAQS, matchFAQ, buildSystemPrompt, FALLBACKS, getFallback } = require('./lib/ai-core');

// ─────────────────────────────────────────────────────────────────────────
// H. STATIC FILES — explicit public asset boundary
// Only files committed under /public are web-accessible. Server code, data,
// migrations, dependency manifests and environment files stay outside it.
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(express.static(PUBLIC_DIR, {
  index: false,
  dotfiles: 'deny',
  fallthrough: true,
  setHeaders(res, filePath) {
    if (path.basename(filePath) === 'sw.js') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Service-Worker-Allowed', '/');
    }
  }
}));

// I. CORS + OPTIONS
// ─────────────────────────────────────────────────────────────────────────
function setCORS(res, req) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN;

  if (allowedOrigin && req && req.headers.origin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PATCH, DELETE, OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-admin-token'
  );
}

app.options('/api/*', (req, res) => { setCORS(res, req); res.sendStatus(204); });

// Same-origin proxy keeps Managed Better Auth session cookies first-party.
// The upstream Neon origin is never exposed to the browser as a cookie domain.
app.all('/api/neon-auth/*', (req, res) => proxyNeonAuth(req, res, req.params[0]));

app.get('/api/auth/me', requireNeonAuth, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({ user: req.auth });
});

// ─────────────────────────────────────────────────────────────────────────
// J. HEALTH + ANALYTICS ENDPOINTS
app.get('/api/health', async (req, res) => {
  if (!isDatabaseConfigured()) {
    return res.status(503).json({ status: 'degraded', database: 'not_configured' });
  }
  try {
    await databaseHealthCheck();
    return res.json({ status: 'ok', database: 'ok' });
  } catch {
    return res.status(503).json({ status: 'degraded', database: 'unavailable' });
  }
});

app.post('/api/analytics/pageview', async (req, res) => {
  const { path: pagePath, referrer, userId } = req.body || {};
  if (!pagePath) return res.status(400).json({ error: 'path is required' });
  try {
    await logPageview(pagePath, referrer, userId);
    return res.json({ ok: true });
  } catch {
    return res.status(503).json({ error: 'Analytics storage unavailable' });
  }
});

app.post('/api/analytics/event', async (req, res) => {
  const { name, meta, userId } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    await persistence.logEvent(name, meta, { userId });
    return res.json({ ok: true });
  } catch {
    return res.status(503).json({ error: 'Analytics storage unavailable' });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// K. PUSH NOTIFICATION ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────
app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ key: VAPID_PUBLIC });
});

app.post('/api/push/subscribe', async (req, res) => {
  setCORS(res, req);
  const { subscription, userId, stage, lang } = req.body || {};
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription' });
  }
  try {
    await persistence.savePushSubscription({ subscription, userId, stage, lang });
    await logEvent('push_subscribe', { stage, lang }, userId);
    return res.json({ ok: true });
  } catch {
    return res.status(503).json({ error: 'Push subscription storage unavailable' });
  }
});

app.post('/api/push/unsubscribe', async (req, res) => {
  const { endpoint, userId } = req.body || {};
  try {
    await persistence.removePushSubscription({ endpoint, userId });
    return res.json({ ok: true });
  } catch {
    return res.status(503).json({ error: 'Push subscription storage unavailable' });
  }
});

// ─────────────────────────────────────────────────────────────────────────
// L. ADMIN API — Neon Auth identity + database-backed application role.
// No password-only admin sessions or process-local admin tokens remain.
// ─────────────────────────────────────────────────────────────────────────
const adminOnly = [requireNeonAuth, requireAppAdmin];

app.post('/api/admin/login', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(410).json({ error: 'Password-based admin login has been retired. Sign in with verified Neon Auth.' });
});

app.post('/api/admin/logout', (req, res) => {
  return res.status(410).json({ error: 'Use Neon Auth sign-out.' });
});

app.get('/api/admin/stats', ...adminOnly, async (req, res) => {
  try {
    const stats = await persistence.getAdminStats();
    const stageNames = { 1:'🌱 Foundation', 2:'🔍 Development', 3:'🎯 Strategic', 4:'🎓 Undergraduate', 5:'🔬 Masters', 6:'🏛️ Doctoral', 7:'👨‍👩‍👧 Parent' };
    stats.stageBreakdown = stats.stageBreakdown.map(item => ({
      ...item,
      name: stageNames[item.id] || `Stage ${item.id}`,
    }));
    return res.json(stats);
  } catch {
    return res.status(503).json({ error: 'Admin data is unavailable' });
  }
});

app.get('/api/admin/inquiries', ...adminOnly, async (req, res) => {
  try {
    const result = await persistence.listInquiries(req.query);
    return res.json(result);
  } catch {
    return res.status(503).json({ error: 'Inquiry data is unavailable' });
  }
});

app.get('/api/admin/analytics', ...adminOnly, async (req, res) => {
  try {
    return res.json(await persistence.getAnalytics({ limit: req.query.limit }));
  } catch {
    return res.status(503).json({ error: 'Analytics data is unavailable' });
  }
});

app.get('/api/admin/sessions', ...adminOnly, async (req, res) => {
  try {
    return res.json({ activeSessions: await persistence.getRecentConversationCount() });
  } catch {
    return res.status(503).json({ error: 'Session data is unavailable' });
  }
});

app.post('/api/admin/push/broadcast', ...adminOnly, async (req, res) => {
  const { title, body, url } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: 'title and body required' });
  try {
    const subscriptions = await persistence.listPushSubscriptions();
    const payload = JSON.stringify({ title: String(title).slice(0, 120), body: String(body).slice(0, 500), url: url || '/', icon: '/logo.jpg', badge: '/logo.jpg' });
    let sent = 0;
    let failed = 0;
    const toRemove = [];
    for (const item of subscriptions) {
      try {
        await webpush.sendNotification(item.subscription, payload);
        sent++;
      } catch (error) {
        failed++;
        if (error.statusCode === 410 || error.statusCode === 404) toRemove.push(item.endpoint);
      }
    }
    const removed = await persistence.removePushEndpoints(toRemove);
    await logEvent('push_broadcast', { sent, failed, removed });
    return res.json({ ok: true, sent, failed, removed });
  } catch {
    return res.status(503).json({ error: 'Push broadcast storage unavailable' });
  }
});

app.post('/api/admin/reset', ...adminOnly, (req, res) => {
  return res.status(410).json({ error: 'Bulk reset is disabled; use an approved retention or data-deletion procedure.' });
});

app.get('/admin', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));

// N. MAIN CHAT ENDPOINT — SSE streaming
//    Flow: FAQ match → Groq AI → Fallback
// ─────────────────────────────────────────────────────────────────────────
app.post('/api/chat/history', async (req, res) => {
  const { userId, conversationId } = req.body || {};
  if (!/^anon_[A-Za-z0-9_-]{16,100}$/.test(String(userId || '')) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(conversationId || ''))) {
    return res.status(400).json({ error: 'Invalid conversation identity' });
  }
  if (!isDatabaseConfigured()) return res.status(503).json({ error: 'Conversation storage is not configured' });
  try {
    const messages = await persistence.getConversationMessages(conversationId, userId, 50);
    return res.setHeader('Cache-Control', 'no-store').json({ messages });
  } catch {
    return res.status(503).json({ error: 'Conversation history unavailable' });
  }
});

app.post('/api/chat', async (req, res) => {
  setCORS(res, req);
  const body = req.body || {};
  const { messages = [], userId, stage, conversationId, messageId } = body;
  const lang = body.lang === 'bn' ? 'bn' : 'en';
  const safeStage = Number.isInteger(Number(stage)) && Number(stage) >= 1 && Number(stage) <= 7 ? Number(stage) : null;
  const safeUserId = typeof userId === 'string' && /^anon_[A-Za-z0-9_-]{16,100}$/.test(userId) ? userId : null;
  const validConversationId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(conversationId || ''));
  const validMessageId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(messageId || ''));
  const userMessages = Array.isArray(messages)
    ? messages.filter(message => message && message.role === 'user' && typeof message.content === 'string').slice(-20)
    : [];
  const lastUserMsg = String(userMessages[userMessages.length - 1]?.content || '').slice(0, 4000);
  if (!safeUserId || !validConversationId || !validMessageId || !lastUserMsg.trim()) {
    return res.status(400).json({ error: 'A valid guest id, conversation id, message id and message are required' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  let previousMessages = [];
  let isFirstMessage = userMessages.length === 1;

  if (process.env.NODE_ENV === 'production' && !isDatabaseConfigured()) {
    return res.status(503).json({ error: 'Persistent conversation storage is required' });
  }

  if (isDatabaseConfigured()) {
    try {
      const ownedConversationId = await persistence.getOrCreateConversation({
        conversationId,
        anonymousId: safeUserId,
        stage: safeStage,
        lang,
      });
      previousMessages = await persistence.getConversationMessages(ownedConversationId, safeUserId, 30);
      isFirstMessage = previousMessages.length === 0;
      await persistence.appendConversationMessage({
        conversationId: ownedConversationId,
        anonymousId: safeUserId,
        role: 'user',
        content: lastUserMsg,
        clientMessageId: messageId,
      });
    } catch {
      return res.status(503).json({ error: 'Persistent conversation storage is unavailable' });
    }
  }

  const contextMessages = isDatabaseConfigured()
    ? [...previousMessages, { role: 'user', content: lastUserMsg }].slice(-30)
    : messages.filter(message => message && ['user', 'assistant'].includes(message.role) && typeof message.content === 'string')
        .slice(-20)
        .map(message => ({ role: message.role, content: message.content.slice(0, 4000) }));

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Conversation-Id', conversationId);
  res.flushHeaders();

  const send = obj => res.write('data: ' + JSON.stringify(obj) + '\\n\\n');
  const done = () => { res.write('data: [DONE]\\n\\n'); res.end(); };
  let inquiryLogged = false;

  try {
    const faqAnswer = matchFAQ(lastUserMsg, lang);
    if (faqAnswer) {
      if (isFirstMessage) {
        await logInquiry({ userId: safeUserId, stage: safeStage, lang, firstMessage: lastUserMsg, ip, source: 'faq' });
        inquiryLogged = true;
      }
      if (isDatabaseConfigured()) {
        await persistence.appendConversationMessage({ conversationId, anonymousId: safeUserId, role: 'assistant', content: faqAnswer, provider: 'faq' });
      }
      for (const word of faqAnswer.split(' ')) {
        send({ choices: [{ delta: { content: word + ' ' } }] });
        await new Promise(resolve => setTimeout(resolve, 18));
      }
      return done();
    }

    if (!process.env.GROQ_API_KEY) throw new Error('AI provider is not configured');
    if (isFirstMessage) {
      await logInquiry({ userId: safeUserId, stage: safeStage, lang, firstMessage: lastUserMsg, ip, source: 'ai' });
      inquiryLogged = true;
    }

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.GROQ_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'system', content: buildSystemPrompt(safeStage, lang) }, ...contextMessages],
        stream: true,
        temperature: 0.65,
        max_tokens: 4096,
        top_p: 0.9,
      }),
    });
    if (!groqRes.ok) throw new Error('AI provider returned HTTP ' + groqRes.status);

    let fullReply = '';
    let sseBuffer = '';
    const reader = groqRes.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done: streamDone, value } = await reader.read();
      if (streamDone) break;
      sseBuffer += decoder.decode(value, { stream: true });
      const lines = sseBuffer.split('\\n');
      sseBuffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const parsed = JSON.parse(raw);
          const token = parsed.choices?.[0]?.delta?.content || '';
          fullReply += token;
          res.write('data: ' + raw + '\\n\\n');
        } catch {}
      }
    }
    if (fullReply && isDatabaseConfigured()) {
      await persistence.appendConversationMessage({
        conversationId,
        anonymousId: safeUserId,
        role: 'assistant',
        content: fullReply,
        provider: 'groq',
        model: 'openai/gpt-oss-120b',
      });
    }
    return done();
  } catch (error) {
    process.stderr.write('[Peopole AI] request failed: ' + String(error.message || 'unknown error') + '\\n');
    if (isFirstMessage && !inquiryLogged) {
      try {
        await logInquiry({ userId: safeUserId, stage: safeStage, lang, firstMessage: lastUserMsg, ip, source: 'fallback' });
      } catch {}
    }
    const fallbackText = getFallback(lang);
    if (isDatabaseConfigured()) {
      try {
        await persistence.appendConversationMessage({
          conversationId,
          anonymousId: safeUserId,
          role: 'assistant',
          content: fallbackText,
          provider: 'fallback',
        });
      } catch {}
    }
    for (const word of fallbackText.split(' ')) {
      send({ choices: [{ delta: { content: word + ' ' } }] });
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    return done();
  }
});

// ─────────────────────────────────────────────────────────────────────────
// O. SPA CATCH-ALL
// ─────────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  logPageview('/', req.headers.referer || '').catch(() => {});
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅  Peopole AI v8.0 running → http://localhost:${PORT}`);
  console.log(`🔐  Admin panel → http://localhost:${PORT}/admin`);
console.log(`📢  Push notifications: ${VAPID_PUBLIC === 'REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY' ? '⚠ VAPID keys not set' : '✓ Configured'}`);
});
