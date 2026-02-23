// server.js — Peopole AI v5.0 | Earth Solutions Visa Zone
// Admin Dashboard + Groq SSE Streaming

const express = require('express');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Data persistence ──────────────────────────────────────
const DATA_DIR  = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'inquiries.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({
    inquiries: [],
    stats: { total: 0, byStage: {}, byLang: { en: 0, bn: 0 }, daily: {} }
  }, null, 2));
}

function loadData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return { inquiries: [], stats: { total: 0, byStage: {}, byLang: { en: 0, bn: 0 }, daily: {} } }; }
}
function saveData(data) {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }
  catch (e) { console.error('Save error:', e.message); }
}
function logInquiry({ stage, lang, firstMessage, ip }) {
  const data  = loadData();
  const today = new Date().toISOString().slice(0, 10);
  data.inquiries.unshift({
    id:      Date.now().toString(),
    stage:   stage || 'unknown',
    lang:    lang  || 'en',
    preview: (firstMessage || '').slice(0, 150),
    time:    new Date().toISOString(),
    ip:      (ip || 'unknown').split(',')[0].trim()
  });
  if (data.inquiries.length > 500) data.inquiries = data.inquiries.slice(0, 500);
  data.stats.total                = (data.stats.total || 0) + 1;
  data.stats.byStage[stage]       = (data.stats.byStage[stage] || 0) + 1;
  data.stats.byLang[lang || 'en'] = (data.stats.byLang[lang || 'en'] || 0) + 1;
  data.stats.daily[today]         = (data.stats.daily[today] || 0) + 1;
  saveData(data);
}

app.use(express.json());

// ── Static files ──────────────────────────────────────────
app.use(express.static(path.join(__dirname), {
  index: false,
  setHeaders(res, filePath) {
    if (filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Service-Worker-Allowed', '/');
    }
  }
}));

// ── Admin Auth Middleware ─────────────────────────────────
function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  const pw    = process.env.ADMIN_PASSWORD || 'earthsolutions2025';
  if (token === pw) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ── Admin: Login ──────────────────────────────────────────
app.post('/api/admin/login', (req, res) => {
  const pw = process.env.ADMIN_PASSWORD || 'earthsolutions2025';
  if (req.body.password === pw) res.json({ success: true, token: pw });
  else res.status(401).json({ error: 'Wrong password' });
});

// ── Admin: Stats ──────────────────────────────────────────
app.get('/api/admin/stats', adminAuth, (req, res) => {
  const data = loadData();
  const STAGE_NAMES = {
    1:'🌱 Foundation', 2:'🔍 Development', 3:'🎯 Strategic',
    4:'🎓 Undergraduate', 5:'🔬 Masters', 6:'🏛️ Doctoral', 7:'👨‍👩‍👧 Parent'
  };
  const daily = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    daily.push({ date: key.slice(5), count: data.stats.daily[key] || 0 });
  }
  const stageBreakdown = Object.entries(data.stats.byStage)
    .map(([id, count]) => ({ id, name: STAGE_NAMES[id] || `Stage ${id}`, count }))
    .sort((a, b) => b.count - a.count);

  res.json({
    total:  data.stats.total || 0,
    today:  data.stats.daily[new Date().toISOString().slice(0,10)] || 0,
    totalEn: data.stats.byLang?.en || 0,
    totalBn: data.stats.byLang?.bn || 0,
    stageBreakdown, daily,
    recentCount: data.inquiries.length
  });
});

// ── Admin: Inquiries ──────────────────────────────────────
app.get('/api/admin/inquiries', adminAuth, (req, res) => {
  const data  = loadData();
  const page  = parseInt(req.query.page)  || 1;
  const limit = parseInt(req.query.limit) || 25;
  let list = data.inquiries;
  if (req.query.stage && req.query.stage !== 'all') list = list.filter(i => String(i.stage) === req.query.stage);
  if (req.query.lang  && req.query.lang  !== 'all') list = list.filter(i => i.lang === req.query.lang);
  res.json({
    inquiries: list.slice((page-1)*limit, page*limit),
    total: list.length, page,
    pages: Math.ceil(list.length / limit)
  });
});

// ── Admin: Reset ──────────────────────────────────────────
app.post('/api/admin/reset', adminAuth, (req, res) => {
  saveData({ inquiries: [], stats: { total: 0, byStage: {}, byLang: { en: 0, bn: 0 }, daily: {} } });
  res.json({ success: true });
});

// ── Admin Dashboard page ──────────────────────────────────
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// ── API: /api/chat (SSE streaming via Groq) ───────────────
app.post('/api/chat', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const { messages = [], system, stage, lang } = req.body;
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set');

    // Log first user message only
    const userMsgs = messages.filter(m => m.role === 'user');
    if (userMsgs.length === 1) {
      logInquiry({
        stage, lang,
        firstMessage: userMsgs[0].content,
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
      });
    }

    const systemContent = system ||
      `You are Peopole AI, an expert academic and visa consultant from Earth Solutions Visa Zone, Dhaka, Bangladesh. Be concise, warm, and practical.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'system', content: systemContent }, ...messages],
        stream: true, temperature: 0.7, max_tokens: 1024
      })
    });

    if (!response.ok) throw new Error(`Groq error ${response.status}: ${await response.text()}`);

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        if (payload === '[DONE]') { res.write('data: [DONE]\n\n'); res.end(); return; }
        res.write(`data: ${payload}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (err) {
    console.error('[Peopole AI Error]', err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

app.options('/api/*', (req, res) => res.sendStatus(200));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => {
  console.log(`✅ Peopole AI running on port ${PORT}`);
  console.log(`🔐 Admin: http://localhost:${PORT}/admin`);
  const pw = process.env.ADMIN_PASSWORD || 'earthsolutions2025';
  console.log(`🔑 Admin password: ${pw}`);
});
