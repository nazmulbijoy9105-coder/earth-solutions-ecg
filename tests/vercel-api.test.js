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
