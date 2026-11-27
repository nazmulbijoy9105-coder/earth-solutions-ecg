'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('Vercel chat streams standards-compliant SSE delimiters', async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousGroqKey = process.env.GROQ_API_KEY;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousGuestSecret = process.env.GUEST_SESSION_SECRET;
  const previousAllowedOrigin = process.env.ALLOWED_ORIGIN;
  const previousFetch = global.fetch;

  delete process.env.DATABASE_URL;
  process.env.GROQ_API_KEY = 'test-key';
  process.env.NODE_ENV = 'test';
  process.env.GUEST_SESSION_SECRET = 'test-secret-with-at-least-32-bytes-long';
  process.env.ALLOWED_ORIGIN = 'https://app.example.test';

  const chunks = [];
  const response = {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    flushHeaders() {},
    write(value) { chunks.push(String(value)); },
    end(value) { if (value !== undefined) chunks.push(String(value)); },
  };

  global.fetch = async () => new Response(
    'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: [DONE]\n\n',
    { status: 200, headers: { 'content-type': 'text/event-stream' } }
  );

  try {
    const module = await import('../api/chat.js');
    await module.default({
      method: 'POST',
      headers: { origin: 'https://app.example.test' },
      body: {
        userId: 'anon_1234567890123456',
        conversationId: '123e4567-e89b-42d3-a456-426614174000',
        messageId: '123e4567-e89b-42d3-a456-426614174001',
        messages: [{ role: 'user', content: 'Hello' }],
      },
    }, response);

    const output = chunks.join('');
    assert.match(output, /data: \{"choices":\[\{"delta":\{"content":"Hello"\}\}\]\}\n\n/);
    assert.match(output, /data: \[DONE\]\n\n$/);
    assert.equal(output.includes(String.fromCharCode(92) + 'n'), false);
  } finally {
    global.fetch = previousFetch;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousGroqKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previousGroqKey;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousGuestSecret === undefined) delete process.env.GUEST_SESSION_SECRET;
    else process.env.GUEST_SESSION_SECRET = previousGuestSecret;
    if (previousAllowedOrigin === undefined) delete process.env.ALLOWED_ORIGIN;
    else process.env.ALLOWED_ORIGIN = previousAllowedOrigin;
  }
});
