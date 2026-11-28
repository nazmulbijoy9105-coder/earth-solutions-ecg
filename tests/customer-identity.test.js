'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveCustomerIdentity } = require('../lib/customer-identity.cjs');

function responseMock() {
  const headers = {};
  return { headers, setHeader(name, value) { headers[name] = value; } };
}

test('guest identity is server-issued, signed, HttpOnly and stable across requests', async () => {
  const previous = process.env.GUEST_SESSION_SECRET;
  process.env.GUEST_SESSION_SECRET = 'test-secret-with-at-least-32-bytes-long';
  try {
    const firstResponse = responseMock();
    const first = await resolveCustomerIdentity({
      headers: { cookie: '', authorization: '' },
      body: { userId: 'guest_attacker_controlled_id' },
    }, firstResponse);
    assert.match(first.anonymousId, /^guest_[A-Za-z0-9_-]{32,80}$/);
    assert.equal(first.ownerId, first.anonymousId);
    const setCookie = firstResponse.headers['Set-Cookie'];
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Lax/);
    assert.match(setCookie, /Path=\/api/);
    assert.doesNotMatch(setCookie, /guest_attacker_controlled_id/);

    const cookie = setCookie.split(';')[0];
    const secondResponse = responseMock();
    const second = await resolveCustomerIdentity({
      headers: { cookie, authorization: '' },
    }, secondResponse);
    assert.equal(second.anonymousId, first.anonymousId);
    assert.equal(secondResponse.headers['Set-Cookie'], undefined);
  } finally {
    if (previous === undefined) delete process.env.GUEST_SESSION_SECRET;
    else process.env.GUEST_SESSION_SECRET = previous;
  }
});


test('malformed authorization schemes are rejected instead of receiving a guest identity', async () => {
  const previous = process.env.GUEST_SESSION_SECRET;
  process.env.GUEST_SESSION_SECRET = 'test-secret-with-at-least-32-bytes-long';
  try {
    await assert.rejects(() => resolveCustomerIdentity({
      headers: { authorization: 'Basic attacker-controlled', cookie: '' },
    }, responseMock()), error => error.statusCode === 401);
  } finally {
    if (previous === undefined) delete process.env.GUEST_SESSION_SECRET;
    else process.env.GUEST_SESSION_SECRET = previous;
  }
});

test('invalid bearer token is rejected instead of silently downgraded to guest', async () => {
  const previousSecret = process.env.GUEST_SESSION_SECRET;
  const previousAuth = process.env.NEON_AUTH_BASE_URL;
  process.env.GUEST_SESSION_SECRET = 'test-secret-with-at-least-32-bytes-long';
  process.env.NEON_AUTH_BASE_URL = 'https://auth.example.test';
  try {
    await assert.rejects(() => resolveCustomerIdentity({
      headers: { authorization: 'Bearer not.a.valid.jwt', cookie: '' },
    }, responseMock()));
  } finally {
    if (previousSecret === undefined) delete process.env.GUEST_SESSION_SECRET;
    else process.env.GUEST_SESSION_SECRET = previousSecret;
    if (previousAuth === undefined) delete process.env.NEON_AUTH_BASE_URL;
    else process.env.NEON_AUTH_BASE_URL = previousAuth;
  }
});
