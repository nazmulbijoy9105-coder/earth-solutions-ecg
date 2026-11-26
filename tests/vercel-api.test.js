'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

function responseMock() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(value) { this.body = value; },
  };
}

test('Vercel health and auth endpoints fail closed when storage or identity is absent', async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const healthModule = await import('../api/health.js');
    const healthRes = responseMock();
    await healthModule.default({ method: 'GET' }, healthRes);
    assert.equal(healthRes.statusCode, 503);
    assert.equal(JSON.parse(healthRes.body).database, 'not_configured');

    const authModule = await import('../api/auth/me.js');
    const authRes = responseMock();
    await authModule.default({ method: 'GET', headers: {} }, authRes);
    assert.equal(authRes.statusCode, 401);
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

test('Vercel chat endpoints reject invalid guest identities before opening a stream', async () => {
  const chatModule = await import('../api/chat.js');
  const chatRes = responseMock();
  await chatModule.default({ method: 'POST', body: { messages: [] }, headers: {} }, chatRes);
  assert.equal(chatRes.statusCode, 400);

  const historyModule = await import('../api/chat/history.js');
  const historyRes = responseMock();
  await historyModule.default({ method: 'POST', body: { userId: 'bad', conversationId: 'bad' }, headers: {} }, historyRes);
  assert.equal(historyRes.statusCode, 400);
});


test('Vercel Neon Auth proxy forwards only trusted same-origin requests', async () => {
  const previousFetch = global.fetch;
  const previousOrigin = process.env.ALLOWED_ORIGIN;
  const previousBase = process.env.NEON_AUTH_BASE_URL;
  let called = false;
  process.env.ALLOWED_ORIGIN = 'https://app.example.test';
  process.env.NEON_AUTH_BASE_URL = 'https://neon.example.test/peopole_ai/auth';
  global.fetch = async (url, options) => {
    called = true;
    assert.equal(String(url), 'https://neon.example.test/peopole_ai/auth/get-session');
    assert.equal(options.headers.get('Origin'), 'https://app.example.test');
    return new Response(JSON.stringify({ session: null }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'set-cookie': 'auth=abc; Path=/; HttpOnly; Secure' },
    });
  };
  try {
    const module = await import('../api/neon-auth/[...path].js');
    const res = responseMock();
    await module.default({
      method: 'GET',
      headers: { origin: 'https://app.example.test' },
      url: '/api/neon-auth/get-session',
      query: { path: ['get-session'] },
    }, res);
    assert.equal(called, true);
    assert.equal(res.statusCode, 200);
    assert.ok(String(res.headers['set-cookie'] || res.headers['Set-Cookie']).includes('Path=/api/neon-auth'));
    assert.equal(res.headers['cache-control'], 'no-store');
  } finally {
    global.fetch = previousFetch;
    if (previousOrigin === undefined) delete process.env.ALLOWED_ORIGIN;
    else process.env.ALLOWED_ORIGIN = previousOrigin;
    if (previousBase === undefined) delete process.env.NEON_AUTH_BASE_URL;
    else process.env.NEON_AUTH_BASE_URL = previousBase;
  }
});
