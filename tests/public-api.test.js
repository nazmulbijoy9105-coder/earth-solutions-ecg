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

test('Vercel analytics and push routes reject unsupported methods and untrusted origins', async () => {
  const previousOrigin = process.env.ALLOWED_ORIGIN;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.ALLOWED_ORIGIN = 'https://app.example.test';
  process.env.DATABASE_URL = 'postgresql://test.invalid/app';
  try {
    const routes = [
      ['../api/analytics/event.js', { method: 'GET', headers: {} }, 405],
      ['../api/analytics/event.js', { method: 'POST', headers: { origin: 'https://attacker.example' }, body: {} }, 403],
      ['../api/analytics/pageview.js', { method: 'GET', headers: {} }, 405],
      ['../api/analytics/pageview.js', { method: 'POST', headers: { origin: 'https://attacker.example' }, body: {} }, 403],
      ['../api/push/subscribe.js', { method: 'GET', headers: {} }, 405],
      ['../api/push/subscribe.js', { method: 'POST', headers: { origin: 'https://attacker.example' }, body: {} }, 403],
    ];
    for (const [path, request, expected] of routes) {
      const handler = (await import(path)).default;
      const res = responseMock();
      await handler(request, res);
      assert.equal(res.statusCode, expected, path);
      assert.equal(res.headers['cache-control'], 'no-store');
    }
  } finally {
    if (previousOrigin === undefined) delete process.env.ALLOWED_ORIGIN;
    else process.env.ALLOWED_ORIGIN = previousOrigin;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

test('Vercel analytics and push routes validate payloads before database access', async () => {
  const previousOrigin = process.env.ALLOWED_ORIGIN;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  process.env.ALLOWED_ORIGIN = 'https://app.example.test';
  process.env.DATABASE_URL = 'postgresql://test.invalid/app';
  const headers = { origin: 'https://app.example.test' };
  try {
    const cases = [
      ['../api/analytics/event.js', { method: 'POST', headers, body: { name: 'bad event name', meta: {} } }, 400],
      ['../api/analytics/pageview.js', { method: 'POST', headers, body: { path: '//evil.example' } }, 400],
      ['../api/push/subscribe.js', { method: 'POST', headers, body: { subscription: {} } }, 400],
    ];
    for (const [path, request, expected] of cases) {
      const handler = (await import(path)).default;
      const res = responseMock();
      await handler(request, res);
      assert.equal(res.statusCode, expected, path);
    }
  } finally {
    if (previousOrigin === undefined) delete process.env.ALLOWED_ORIGIN;
    else process.env.ALLOWED_ORIGIN = previousOrigin;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

test('Vercel analytics and push routes fail closed when durable storage is absent', async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousOrigin = process.env.ALLOWED_ORIGIN;
  delete process.env.DATABASE_URL;
  process.env.ALLOWED_ORIGIN = 'https://app.example.test';
  try {
    const cases = [
      ['../api/analytics/event.js', { name: 'valid.event' }],
      ['../api/analytics/pageview.js', { path: '/home' }],
      ['../api/push/subscribe.js', { userId: 'anon_1234567890123456', subscription: { endpoint: 'https://push.example.test/x', keys: { p256dh: 'key', auth: 'auth' } } }],
    ];
    for (const [path, body] of cases) {
      const handler = (await import(path)).default;
      const res = responseMock();
      await handler({ method: 'POST', headers: { origin: 'https://app.example.test' }, body }, res);
      assert.equal(res.statusCode, 503, path);
    }
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousOrigin === undefined) delete process.env.ALLOWED_ORIGIN;
    else process.env.ALLOWED_ORIGIN = previousOrigin;
  }
});


test('Vercel VAPID endpoint does not publish a placeholder key or wildcard CORS', async () => {
  const previousKey = process.env.VAPID_PUBLIC;
  delete process.env.VAPID_PUBLIC;
  try {
    const handler = (await import('../api/push/vapid-public-key.js')).default;
    const res = responseMock();
    await handler({ method: 'GET', headers: {} }, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.headers['access-control-allow-origin'], undefined);
    assert.match(res.body, /not configured/);
  } finally {
    if (previousKey === undefined) delete process.env.VAPID_PUBLIC;
    else process.env.VAPID_PUBLIC = previousKey;
  }
});


test('Vercel VAPID endpoint rejects malformed public keys', async () => {
  const previousKey = process.env.VAPID_PUBLIC;
  process.env.VAPID_PUBLIC = 'not-a-valid-vapid-key';
  try {
    const handler = (await import('../api/push/vapid-public-key.js')).default;
    const res = responseMock();
    await handler({ method: 'GET', headers: {} }, res);
    assert.equal(res.statusCode, 503);
  } finally {
    if (previousKey === undefined) delete process.env.VAPID_PUBLIC;
    else process.env.VAPID_PUBLIC = previousKey;
  }
});


test('Vercel VAPID endpoint requires both public and private server configuration', async () => {
  const previousPublic = process.env.VAPID_PUBLIC;
  const previousPrivate = process.env.VAPID_PRIVATE;
  process.env.VAPID_PUBLIC = Buffer.alloc(65, 7).toString('base64url');
  delete process.env.VAPID_PRIVATE;
  try {
    const handler = (await import('../api/push/vapid-public-key.js')).default;
    const res = responseMock();
    await handler({ method: 'GET', headers: {} }, res);
    assert.equal(res.statusCode, 503);
  } finally {
    if (previousPublic === undefined) delete process.env.VAPID_PUBLIC;
    else process.env.VAPID_PUBLIC = previousPublic;
    if (previousPrivate === undefined) delete process.env.VAPID_PRIVATE;
    else process.env.VAPID_PRIVATE = previousPrivate;
  }
});
