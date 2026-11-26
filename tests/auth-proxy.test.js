'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const proxyNeonAuth = require('../lib/auth-proxy.cjs');

function createResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(value) { this.body = value; },
  };
}

test('same-origin auth proxy preserves auth path, origin and rewrites cookie scope', async () => {
  const previousFetch = global.fetch;
  const previousOrigin = process.env.ALLOWED_ORIGIN;
  const previousBase = process.env.NEON_AUTH_BASE_URL;
  let requestedUrl;
  let requestedOptions;

  process.env.ALLOWED_ORIGIN = 'https://app.example.test';
  process.env.NEON_AUTH_BASE_URL = 'https://neon.example.test/peopole_ai/auth';
  global.fetch = async (url, options) => {
    requestedUrl = String(url);
    requestedOptions = options;
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'set-cookie': 'session=secret; Path=/; HttpOnly; SameSite=Lax; Secure',
      },
    });
  };

  try {
    const req = {
      method: 'GET',
      headers: { origin: 'https://app.example.test', cookie: 'session=old' },
      originalUrl: '/api/neon-auth/get-session?disableCookieCache=true',
      url: '/api/neon-auth/get-session?disableCookieCache=true',
    };
    const res = createResponse();
    await proxyNeonAuth(req, res, 'get-session');

    assert.equal(requestedUrl, 'https://neon.example.test/peopole_ai/auth/get-session?disableCookieCache=true');
    assert.equal(requestedOptions.headers.get('Origin'), 'https://app.example.test');
    assert.equal(requestedOptions.headers.get('Cookie'), 'session=old');
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body.toString()), { ok: true });
    assert.match(String(res.headers['set-cookie']), /Path=\/api\/neon-auth/);
    assert.doesNotMatch(String(res.headers['set-cookie']), /Domain=/i);
  } finally {
    global.fetch = previousFetch;
    if (previousOrigin === undefined) delete process.env.ALLOWED_ORIGIN;
    else process.env.ALLOWED_ORIGIN = previousOrigin;
    if (previousBase === undefined) delete process.env.NEON_AUTH_BASE_URL;
    else process.env.NEON_AUTH_BASE_URL = previousBase;
  }
});

test('auth proxy rejects untrusted origins and path traversal before upstream fetch', async () => {
  const previousFetch = global.fetch;
  const previousOrigin = process.env.ALLOWED_ORIGIN;
  const previousBase = process.env.NEON_AUTH_BASE_URL;
  let called = false;

  process.env.ALLOWED_ORIGIN = 'https://app.example.test';
  process.env.NEON_AUTH_BASE_URL = 'https://neon.example.test/peopole_ai/auth';
  global.fetch = async () => { called = true; throw new Error('must not fetch'); };

  try {
    const badOriginRes = createResponse();
    await proxyNeonAuth({
      method: 'GET',
      headers: { origin: 'https://attacker.example' },
      originalUrl: '/api/neon-auth/get-session',
    }, badOriginRes, 'get-session');
    assert.equal(badOriginRes.statusCode, 403);

    const traversalRes = createResponse();
    await proxyNeonAuth({
      method: 'GET',
      headers: { origin: 'https://app.example.test' },
      originalUrl: '/api/neon-auth/../server.js',
    }, traversalRes, '../server.js');
    assert.equal(traversalRes.statusCode, 400);
    assert.equal(called, false);
  } finally {
    global.fetch = previousFetch;
    if (previousOrigin === undefined) delete process.env.ALLOWED_ORIGIN;
    else process.env.ALLOWED_ORIGIN = previousOrigin;
    if (previousBase === undefined) delete process.env.NEON_AUTH_BASE_URL;
    else process.env.NEON_AUTH_BASE_URL = previousBase;
  }
});
