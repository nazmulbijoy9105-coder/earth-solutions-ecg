// api/chat.js — Peopole AI Backend v5
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
