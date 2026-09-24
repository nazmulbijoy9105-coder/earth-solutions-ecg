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
const fs        = require('fs');
const crypto    = require('crypto');
const webpush   = require('web-push');

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
// B. DISK PERSISTENCE
// ─────────────────────────────────────────────────────────────────────────
const DATA_DIR       = path.join(__dirname, 'data');
const DATA_FILE      = path.join(DATA_DIR, 'inquiries.json');
const PUSH_FILE      = path.join(DATA_DIR, 'push_subscriptions.json');
const ANALYTICS_FILE = path.join(DATA_DIR, 'analytics.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function ensureFile(file, defaultVal) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(defaultVal, null, 2));
}
ensureFile(DATA_FILE,      { inquiries: [], stats: { total: 0, byStage: {}, byLang: { en: 0, bn: 0 }, daily: {}, sources: { faq: 0, ai: 0, fallback: 0 } } });
ensureFile(PUSH_FILE,      { subscriptions: [] });
ensureFile(ANALYTICS_FILE, { events: [], pageviews: {} });

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}
function writeJSON(file, data) {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }
  catch (e) { console.error('[IO] Write error:', e.message); }
}

function logInquiry({ userId, stage, lang, firstMessage, ip, source }) {
  const data  = readJSON(DATA_FILE, { inquiries: [], stats: { total: 0, byStage: {}, byLang: { en: 0, bn: 0 }, daily: {}, sources: { faq: 0, ai: 0, fallback: 0 } } });
  const today = new Date().toISOString().slice(0, 10);
  data.inquiries.unshift({
    id: Date.now().toString(), userId: userId || 'anon',
    stage: stage || 'unknown', lang: lang || 'en',
    source: source || 'ai',
    preview: (firstMessage || '').slice(0, 150),
    time: new Date().toISOString(),
    ip: (ip || 'unknown').split(',')[0].trim()
  });
  if (data.inquiries.length > 2000) data.inquiries = data.inquiries.slice(0, 2000);
  data.stats.total                    = (data.stats.total || 0) + 1;
  data.stats.byStage[stage]           = (data.stats.byStage[stage] || 0) + 1;
  data.stats.byLang[lang || 'en']     = (data.stats.byLang[lang || 'en'] || 0) + 1;
  data.stats.daily[today]             = (data.stats.daily[today] || 0) + 1;
  if (!data.stats.sources) data.stats.sources = { faq: 0, ai: 0, fallback: 0 };
  data.stats.sources[source || 'ai']  = (data.stats.sources[source || 'ai'] || 0) + 1;
  writeJSON(DATA_FILE, data);
}

// ─────────────────────────────────────────────────────────────────────────
// C. ANALYTICS — built-in (no Google Analytics / no 3rd party required)
//    Also provides optional ad slot revenue data
// ─────────────────────────────────────────────────────────────────────────
function logPageview(path, referrer) {
  const data = readJSON(ANALYTICS_FILE, { events: [], pageviews: {} });
  data.pageviews[path] = (data.pageviews[path] || 0) + 1;
  if (data.events.length < 10000) data.events.push({ type: 'pageview', path, referrer, time: new Date().toISOString() });
  writeJSON(ANALYTICS_FILE, data);
}
function logEvent(name, meta) {
  const data = readJSON(ANALYTICS_FILE, { events: [], pageviews: {} });
  if (data.events.length < 10000) data.events.push({ type: 'event', name, meta, time: new Date().toISOString() });
  writeJSON(ANALYTICS_FILE, data);
}

// ─────────────────────────────────────────────────────────────────────────
// D. SESSION MEMORY — in-memory store keyed by userId
//    Drop-in upgrade: replace Map with db.collection('sessions') calls
// ─────────────────────────────────────────────────────────────────────────
const SESSION_MAX = 30;
const SESSION_TTL = 3 * 60 * 60 * 1000;
const sessions    = new Map();

function getSession(userId) {
  if (!userId) return { messages: [], stage: null, lang: 'en' };
  if (!sessions.has(userId)) sessions.set(userId, { messages: [], lastActive: Date.now(), stage: null, lang: 'en' });
  const s = sessions.get(userId);
  s.lastActive = Date.now();
  return s;
}
function pushMsg(userId, role, content) {
  if (!userId) return;
  const s = getSession(userId);
  s.messages.push({ role, content });
  if (s.messages.length > SESSION_MAX) s.messages = s.messages.slice(-SESSION_MAX);
}

setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL;
  for (const [id, s] of sessions) if (s.lastActive < cutoff) sessions.delete(id);
}, 30 * 60 * 1000);

// ─────────────────────────────────────────────────────────────────────────
// E. SERVER-SIDE FAQ DATABASE — instant answers, zero Groq cost
// ─────────────────────────────────────────────────────────────────────────
// AI core (FAQs, stage prompts, fallbacks) lives in lib/ai-core.js, shared with api/chat.js
const { SERVER_FAQS, matchFAQ, buildSystemPrompt, FALLBACKS, getFallback } = require('./lib/ai-core');

// ─────────────────────────────────────────────────────────────────────────
// H. STATIC FILES
// ─────────────────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname), {
  index: false,
  setHeaders(res, filePath) {
    if (filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Service-Worker-Allowed', '/');
    }
  }
}));

// ─────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────
// J. ANALYTICS ENDPOINTS (built-in, no 3rd party)
// ─────────────────────────────────────────────────────────────────────────
app.post('/api/analytics/pageview', (req, res) => {
  const { path: p, referrer } = req.body;
  if (p) logPageview(p, referrer);
  res.json({ ok: true });
});
app.post('/api/analytics/event', (req, res) => {
  const { name, meta } = req.body;
  if (name) logEvent(name, meta);
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────
// K. PUSH NOTIFICATION ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────

// Return VAPID public key to frontend
app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ key: VAPID_PUBLIC });
});

// Save push subscription
app.post('/api/push/subscribe', (req, res) => {
  setCORS(res, req);
  const { subscription, userId, stage, lang } = req.body;
  if (!subscription || !subscription.endpoint) return res.status(400).json({ error: 'Invalid subscription' });

  const data = readJSON(PUSH_FILE, { subscriptions: [] });
  const exists = data.subscriptions.find(s => s.endpoint === subscription.endpoint);
  if (!exists) {
    data.subscriptions.push({ subscription, userId: userId || 'anon', stage, lang, createdAt: new Date().toISOString() });
    if (data.subscriptions.length > 5000) data.subscriptions = data.subscriptions.slice(-5000);
    writeJSON(PUSH_FILE, data);
    logEvent('push_subscribe', { userId, stage, lang });
  }
  res.json({ ok: true });
});

// Unsubscribe
app.post('/api/push/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  const data = readJSON(PUSH_FILE, { subscriptions: [] });
  data.subscriptions = data.subscriptions.filter(s => s.endpoint !== endpoint);
  writeJSON(PUSH_FILE, data);
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────
// L. ADMIN AUTH MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────
const ADMIN_SESSION_TTL = 8 * 60 * 60 * 1000;
const adminSessions = new Map();

const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_LOGIN_MAX_ATTEMPTS = 10;
const adminLoginBuckets = new Map();

function adminLoginRateLimit(req, res, next) {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

  const now = Date.now();
  let bucket = adminLoginBuckets.get(clientIp);

  if (!bucket || now - bucket.windowStart >= ADMIN_LOGIN_WINDOW_MS) {
    bucket = {
      windowStart: now,
      count: 0
    };
  }

  bucket.count += 1;
  adminLoginBuckets.set(clientIp, bucket);

  if (bucket.count > ADMIN_LOGIN_MAX_ATTEMPTS) {
    const retryAfter = Math.max(
      1,
      Math.ceil(
        (ADMIN_LOGIN_WINDOW_MS - (now - bucket.windowStart)) / 1000
      )
    );

    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: 'Too many login attempts. Please try again later.'
    });
  }

  next();
}

function getAdminPassword() {
  const pw = process.env.ADMIN_PASSWORD;

  if (!pw || pw.length < 12) {
    throw new Error(
      'ADMIN_PASSWORD must be configured and contain at least 12 characters'
    );
  }

  return pw;
}

function extractAdminBearer(req) {
  const header = req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    return null;
  }

  const token = header.slice(7).trim();

  return token || null;
}

function adminAuth(req, res, next) {
  const token = extractAdminBearer(req);

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized'
    });
  }

  const session = adminSessions.get(token);

  if (!session) {
    return res.status(401).json({
      error: 'Invalid admin session'
    });
  }

  if (Date.now() >= session.expiresAt) {
    adminSessions.delete(token);

    return res.status(401).json({
      error: 'Admin session expired'
    });
  }

  req.adminSession = session;

  next();
}

app.locals.adminAuth = adminAuth;

app.post('/api/admin/login', adminLoginRateLimit, (req, res) => {
  let configuredPassword;

  try {
    configuredPassword = getAdminPassword();
  } catch (_) {
    return res.status(503).json({
      error: 'Admin authentication is not configured'
    });
  }

  const supplied =
    typeof req.body?.password === 'string'
      ? req.body.password
      : '';

  const expectedBuffer =
    Buffer.from(configuredPassword, 'utf8');

  const suppliedBuffer =
    Buffer.from(supplied, 'utf8');

  const valid =
    expectedBuffer.length === suppliedBuffer.length &&
    crypto.timingSafeEqual(
      expectedBuffer,
      suppliedBuffer
    );

  if (!valid) {
    return res.status(401).json({
      error: 'Wrong password'
    });
  }

  const token =
    crypto.randomBytes(32).toString('base64url');

  const expiresAt =
    Date.now() + ADMIN_SESSION_TTL;

  adminSessions.set(token, {
    createdAt: Date.now(),
    expiresAt
  });

  return res.json({
    success: true,
    token,
    expiresAt
  });
});

app.post('/api/admin/logout', adminAuth, (req, res) => {
  const token = extractAdminBearer(req);

  if (token) {
    adminSessions.delete(token);
  }

  return res.json({
    success: true
  });
});

app.get('/api/admin/stats', adminAuth, (req, res) => {
  const data = readJSON(DATA_FILE, { inquiries: [], stats: {} });
  const STAGE_NAMES = { 1:'🌱 Foundation', 2:'🔍 Development', 3:'🎯 Strategic', 4:'🎓 Undergraduate', 5:'🔬 Masters', 6:'🏛️ Doctoral', 7:'👨‍👩‍👧 Parent' };
  const daily = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    daily.push({ date: key.slice(5), count: data.stats.daily?.[key] || 0 });
  }
  const stageBreakdown = Object.entries(data.stats.byStage || {}).map(([id, count]) => ({ id, name: STAGE_NAMES[id] || `Stage ${id}`, count })).sort((a, b) => b.count - a.count);
  const analytics = readJSON(ANALYTICS_FILE, { events: [], pageviews: {} });
  const push = readJSON(PUSH_FILE, { subscriptions: [] });
  res.json({
    total:  data.stats.total || 0,
    today:  data.stats.daily?.[new Date().toISOString().slice(0,10)] || 0,
    totalEn: data.stats.byLang?.en || 0,
    totalBn: data.stats.byLang?.bn || 0,
    sources: data.stats.sources || {},
    stageBreakdown, daily,
    totalPageviews: Object.values(analytics.pageviews).reduce((a, b) => a + b, 0),
    pushSubscribers: push.subscriptions.length,
    recentCount: data.inquiries.length
  });
});

app.get('/api/admin/inquiries', adminAuth, (req, res) => {
  const data  = readJSON(DATA_FILE, { inquiries: [] });
  const page  = parseInt(req.query.page)  || 1;
  const limit = parseInt(req.query.limit) || 25;
  let list = data.inquiries;
  if (req.query.stage && req.query.stage !== 'all') list = list.filter(i => String(i.stage) === req.query.stage);
  if (req.query.lang  && req.query.lang  !== 'all') list = list.filter(i => i.lang === req.query.lang);
  if (req.query.source && req.query.source !== 'all') list = list.filter(i => i.source === req.query.source);
  res.json({ inquiries: list.slice((page-1)*limit, page*limit), total: list.length, page, pages: Math.ceil(list.length / limit) });
});

app.get('/api/admin/analytics', adminAuth, (req, res) => {
  const data = readJSON(ANALYTICS_FILE, { events: [], pageviews: {} });
  res.json(data);
});

app.get('/api/admin/sessions', adminAuth, (req, res) => {
  res.json({ activeSessions: sessions.size, ids: [...sessions.keys()].slice(0, 50) });
});

// Admin: send push notification to all subscribers
app.post('/api/admin/push/broadcast', adminAuth, async (req, res) => {
  const { title, body, url } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'title and body required' });
  const data    = readJSON(PUSH_FILE, { subscriptions: [] });
  const payload = JSON.stringify({ title, body, url: url || '/', icon: '/logo.jpg', badge: '/logo.jpg' });
  let sent = 0, failed = 0;
  const toRemove = [];
  for (const sub of data.subscriptions) {
    try {
      await webpush.sendNotification(sub.subscription, payload);
      sent++;
    } catch (e) {
      failed++;
      if (e.statusCode === 410 || e.statusCode === 404) toRemove.push(sub.subscription.endpoint);
    }
  }
  if (toRemove.length) {
    data.subscriptions = data.subscriptions.filter(s => !toRemove.includes(s.endpoint));
    writeJSON(PUSH_FILE, data);
  }
  logEvent('push_broadcast', { title, sent, failed });
  res.json({ ok: true, sent, failed, removed: toRemove.length });
});

app.post('/api/admin/reset', adminAuth, (req, res) => {
  writeJSON(DATA_FILE, { inquiries: [], stats: { total: 0, byStage: {}, byLang: { en: 0, bn: 0 }, daily: {}, sources: { faq: 0, ai: 0, fallback: 0 } } });
  res.json({ success: true });
});

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// ─────────────────────────────────────────────────────────────────────────
// N. MAIN CHAT ENDPOINT — SSE streaming
//    Flow: FAQ match → Groq AI → Fallback
// ─────────────────────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  setCORS(res, req);
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  const done  = ()   => { res.write('data: [DONE]\n\n'); res.end(); };

  try {
    const { messages = [], userId, stage, lang = 'en' } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    // Merge server session memory with client-sent messages
    const session = getSession(userId);
    if (stage) session.stage = stage;
    if (lang)  session.lang  = lang;

    // Last user message
    const userMsgs   = messages.filter(m => m.role === 'user');
    const lastUserMsg = userMsgs[userMsgs.length - 1]?.content || '';

    // ── 1. FAQ instant match ─────────────────────────────────────────
    const faqAnswer = matchFAQ(lastUserMsg, lang);
    if (faqAnswer) {
      // Stream FAQ answer character-by-character for natural feel
      if (userMsgs.length === 1) logInquiry({ userId, stage, lang, firstMessage: lastUserMsg, ip, source: 'faq' });
      pushMsg(userId, 'user', lastUserMsg);
      pushMsg(userId, 'assistant', faqAnswer);
      const words = faqAnswer.split(' ');
      for (const word of words) {
        send({ choices: [{ delta: { content: word + ' ' } }] });
        await new Promise(r => setTimeout(r, 18));
      }
      return done();
    }

    // ── 2. Groq AI ───────────────────────────────────────────────────
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set');

    if (userMsgs.length === 1) logInquiry({ userId, stage, lang, firstMessage: lastUserMsg, ip, source: 'ai' });
    pushMsg(userId, 'user', lastUserMsg);

    // Combine server session history + incoming messages (deduplicated)
    const contextMessages = [...session.messages.slice(0, -1), ...messages].slice(-30);

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:       'openai/gpt-oss-120b',
        messages:    [{ role: 'system', content: buildSystemPrompt(stage, lang) }, ...contextMessages],
        stream:      true,
        temperature: 0.65,
        max_tokens:  4096,
        top_p:       0.9
      })
    });

    if (!groqRes.ok) throw new Error(`Groq ${groqRes.status}: ${await groqRes.text()}`);

    let fullReply = '';
    let sseBuf = '';
    const reader  = groqRes.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done: d, value } = await reader.read();
      if (d) break;
      const chunk = decoder.decode(value, { stream: true });
      sseBuf += chunk;
      const sseLines = sseBuf.split('\n');
      sseBuf = sseLines.pop();
      for (const line of sseLines) {
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const parsed = JSON.parse(raw);
          const token  = parsed.choices?.[0]?.delta?.content || '';
          fullReply   += token;
          res.write(`data: ${raw}\n\n`);
        } catch {}
      }
    }

    if (fullReply) pushMsg(userId, 'assistant', fullReply);
    return done();

  } catch (err) {
    console.error('[Peopole AI]', err.message);

    // ── 3. Fallback ──────────────────────────────────────────────────
    const { lang = 'en', userId, stage, messages = [] } = req.body;
    const userMsgs = messages.filter(m => m.role === 'user');
    if (userMsgs.length === 1) {
      logInquiry({ userId, stage, lang, firstMessage: userMsgs[0]?.content, ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress, source: 'fallback' });
    }
    const fallbackText = getFallback(lang);
    const words = fallbackText.split(' ');
    for (const word of words) {
      send({ choices: [{ delta: { content: word + ' ' } }] });
      await new Promise(r => setTimeout(r, 20));
    }
    return done();
  }
});

// ─────────────────────────────────────────────────────────────────────────
// O. SPA CATCH-ALL
// ─────────────────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  logPageview(req.path, req.headers.referer || '');
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅  Peopole AI v8.0 running → http://localhost:${PORT}`);
  console.log(`🔐  Admin panel → http://localhost:${PORT}/admin`);
console.log(`📢  Push notifications: ${VAPID_PUBLIC === 'REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY' ? '⚠ VAPID keys not set' : '✓ Configured'}`);
});
