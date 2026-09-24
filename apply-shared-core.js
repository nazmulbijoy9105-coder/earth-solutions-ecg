// apply-shared-core.js — run from the repo root:  node apply-shared-core.js
// 1. Moves SERVER_FAQS, matchFAQ, buildSystemPrompt, FALLBACKS, getFallback out of server.js into lib/ai-core.js
// 2. server.js requires that module (behaviour unchanged)
// 3. api/chat.js is rebuilt to use it when USE_FULL_PROMPT=1 (default OFF: same generic prompt as today)
// Everything is validated in memory (including a smoke test of every stage x language). Nothing is written on failure.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

function fail(m) { console.error('ABORT: ' + m); process.exit(1); }
const norm = t => t.replace(/\r\n/g, '\n');
const back = (t, crlf) => (crlf ? t.replace(/\n/g, '\r\n') : t);

for (const f of ['server.js', 'api/chat.js']) if (!fs.existsSync(f)) fail('missing ' + f + ' (run from repo root)');
if (fs.existsSync('lib/ai-core.js')) fail('lib/ai-core.js already exists');

const rawServer = fs.readFileSync('server.js', 'utf8');
const rawApi = fs.readFileSync('api/chat.js', 'utf8');
const s = norm(rawServer);
if (!norm(rawApi).includes('api.groq.com') || !norm(rawApi).includes('ALLOWED_ORIGIN')) fail('api/chat.js is not the expected file');

function count(str, sub) { return str.split(sub).length - 1; }
for (const marker of ['const SERVER_FAQS = [', 'function matchFAQ(', 'function buildSystemPrompt(', 'const FALLBACKS = {', 'function getFallback(lang) {']) {
  if (count(s, marker) !== 1) fail('expected exactly 1 of: ' + marker + ' (found ' + count(s, marker) + ')');
}

// chunk = from SERVER_FAQS to the closing brace of getFallback (the static-files middleware after it stays in server.js)
const start = s.indexOf('const SERVER_FAQS = [');
const gfIdx = s.indexOf('function getFallback(lang) {');
const closeIdx = s.indexOf('\n}\n', gfIdx);
if (closeIdx < 0 || gfIdx < start) fail('could not find the end of getFallback');
const end = closeIdx + 3;
const chunk = s.slice(start, end);
if (chunk.includes('app.use(') || chunk.includes('app.get(') || chunk.includes('app.post(')) fail('chunk contains Express routes - boundaries are wrong');

const names = [...chunk.matchAll(/^(?:async\s+function|function|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
for (const n of ['SERVER_FAQS', 'matchFAQ', 'buildSystemPrompt', 'FALLBACKS', 'getFallback']) if (!names.includes(n)) fail('missing top-level name ' + n);

const moduleText = "'use strict';\n// Shared AI core: FAQs, stage prompts, fallbacks. Used by server.js and api/chat.js.\n\n" +
  chunk + '\nmodule.exports = { ' + names.join(', ') + ' };\n';
const newServer = s.slice(0, start) +
  '// AI core (FAQs, stage prompts, fallbacks) lives in lib/ai-core.js, shared with api/chat.js\n' +
  'const { ' + names.join(', ') + " } = require('./lib/ai-core');\n" + s.slice(end);

// ── api/chat.js (no backticks or template placeholders inside, so it can live in a raw string) ──
const API = String.raw`// api/chat.js — Peopole AI Backend v5
// Earth Solutions Visa Zone | Groq gpt-oss-120b | SSE streaming
// USE_FULL_PROMPT=1  -> shared FAQ engine + stage prompts + fallback pool (lib/ai-core.js)
// otherwise          -> the generic one-line prompt, exactly as before
import core from '../lib/ai-core.js';

const { buildSystemPrompt, matchFAQ, getFallback } = core;

const GENERIC_PROMPT = 'You are Peopole AI, an expert academic and visa consultant from Earth Solutions Visa Zone, Dhaka, Bangladesh. Be concise, warm, and practical.';

export default async function handler(req, res) {
  const FULL = process.env.USE_FULL_PROMPT === '1';
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'https://earth-solutions-ecg.vercel.app';

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.statusCode = 200; res.end(); return; }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const send = obj => res.write('data: ' + JSON.stringify(obj) + '\n\n');
  const finish = () => { res.write('data: [DONE]\n\n'); res.end(); };
  const streamText = async (text, delayMs) => {
    for (const word of text.split(' ')) {
      send({ choices: [{ delta: { content: word + ' ' } }] });
      await new Promise(r => setTimeout(r, delayMs));
    }
  };

  const body = req.body || {};
  const lang = body.lang === 'bn' ? 'bn' : 'en';
  const stageNum = Number(body.stage);
  const stage = stageNum >= 1 && stageNum <= 7 ? stageNum : null;

  try {
    // Only user/assistant turns are accepted from the client: no injected system messages, bounded size.
    const safeMessages = (Array.isArray(body.messages) ? body.messages : [])
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));
    if (!safeMessages.length) throw new Error('No messages');

    const lastUser = [...safeMessages].reverse().find(m => m.role === 'user');
    if (FULL && lastUser) {
      const faq = matchFAQ(lastUser.content, lang);
      if (faq) { await streamText(faq, 18); return finish(); }
    }

    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set');

    const payload = {
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'system', content: FULL ? buildSystemPrompt(stage, lang) : GENERIC_PROMPT }, ...safeMessages],
      stream: true,
      temperature: FULL ? 0.65 : 0.7,
      max_tokens: 4096
    };
    if (FULL) payload.top_p = 0.9;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + process.env.GROQ_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error('Groq API error ' + response.status + ': ' + errText);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let sseBuf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sseBuf += decoder.decode(value, { stream: true });
      const lines = sseBuf.split('\n');
      sseBuf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (!raw) continue;
        if (raw === '[DONE]') return finish();
        res.write('data: ' + raw + '\n\n');
      }
    }
    return finish();

  } catch (err) {
    console.error('[Peopole AI Error]', err.message);
    try {
      if (FULL) { await streamText(getFallback(lang), 20); return finish(); }
      send({ error: 'Service temporarily unavailable. Please try again.' });
      res.end();
    } catch (_) { try { res.end(); } catch (__) {} }
  }
}
`;

// ── smoke test the module before writing anything ──
const tmp = path.join('lib', '.ai-core.check.js');
fs.mkdirSync('lib', { recursive: true });
fs.writeFileSync(tmp, moduleText);
try {
  const core = require(path.resolve(tmp));
  for (const st of [null, 1, 2, 3, 4, 5, 6, 7]) for (const lg of ['en', 'bn']) {
    const p = core.buildSystemPrompt(st, lg);
    if (typeof p !== 'string' || p.length < 200) throw new Error('buildSystemPrompt(' + st + ',' + lg + ') returned a too-short value');
  }
  core.matchFAQ('hello', 'en'); core.matchFAQ('ielts', 'bn');
  if (typeof core.getFallback('en') !== 'string' || typeof core.getFallback('bn') !== 'string') throw new Error('getFallback failed');
} catch (e) { fs.unlinkSync(tmp); fail('smoke test failed: ' + e.message); }
fs.unlinkSync(tmp);

const tmpServer = 'server.__check.js';
fs.writeFileSync(tmpServer, newServer);
try { cp.execFileSync(process.execPath, ['--check', tmpServer], { stdio: 'pipe' }); }
catch (e) { fs.unlinkSync(tmpServer); fail('new server.js failed syntax check'); }
fs.unlinkSync(tmpServer);

const tmpApi = path.join('api', '__check.js');
fs.writeFileSync(tmpApi, API);
try { cp.execFileSync(process.execPath, ['--check', tmpApi], { stdio: 'pipe' }); }
catch (e) { fs.unlinkSync(tmpApi); fail('new api/chat.js failed syntax check'); }
fs.unlinkSync(tmpApi);

// ── write ──
fs.writeFileSync('lib/ai-core.js', moduleText);
fs.writeFileSync('server.js', back(newServer, rawServer.includes('\r\n')));
fs.writeFileSync('api/chat.js', back(API, rawApi.includes('\r\n')));
console.log('OK: lib/ai-core.js (' + names.join(', ') + '), server.js, api/chat.js');
console.log('Moved ' + chunk.split('\n').length + ' lines out of server.js. USE_FULL_PROMPT is OFF until you set it in Vercel.');
