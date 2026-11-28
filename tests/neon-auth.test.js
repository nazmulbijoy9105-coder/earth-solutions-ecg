'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  verifyNeonToken,
  resetJwksCacheForTests,
  InvalidNeonTokenError,
} = require('../lib/neon-auth.cjs');

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function makeToken(privateKey, claims, kid = 'test-ed25519') {
  const header = encode({ alg: 'EdDSA', typ: 'JWT', kid });
  const payload = encode(claims);
  const input = header + '.' + payload;
  const signature = crypto.sign(null, Buffer.from(input), privateKey).toString('base64url');
  return input + '.' + signature;
}

test('Neon EdDSA token verification checks signature, issuer, audience and verified identity', async () => {
  const previousFetch = global.fetch;
  const previousBase = process.env.NEON_AUTH_BASE_URL;
  const previousJwks = process.env.NEON_AUTH_JWKS_URL;
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-ed25519', alg: 'EdDSA', use: 'sig', key_ops: ['verify'] };

  process.env.NEON_AUTH_BASE_URL = 'https://auth.example.test/peopole_ai/auth';
  process.env.NEON_AUTH_JWKS_URL = 'https://auth.example.test/peopole_ai/auth/.well-known/jwks.json';
  global.fetch = async () => new Response(JSON.stringify({ keys: [jwk] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
  resetJwksCacheForTests();

  try {
    const now = Math.floor(Date.now() / 1000);
    const token = makeToken(privateKey, {
      iss: 'https://auth.example.test',
      aud: 'https://auth.example.test',
      sub: '860dc360-609f-4b7d-9e70-ec93fe6414d3',
      email: 'verified@example.test',
      name: 'Verified User',
      emailVerified: true,
      banned: false,
      iat: now,
      exp: now + 900,
    });
    const user = await verifyNeonToken(token);
    assert.deepEqual(user, {
      id: '860dc360-609f-4b7d-9e70-ec93fe6414d3',
      email: 'verified@example.test',
      name: 'Verified User',
      emailVerified: true,
    });

    const wrongIssuer = makeToken(privateKey, {
      iss: 'https://attacker.example',
      aud: 'https://auth.example.test',
      sub: '860dc360-609f-4b7d-9e70-ec93fe6414d3',
      email: 'verified@example.test',
      emailVerified: true,
      iat: now,
      exp: now + 900,
    });
    await assert.rejects(() => verifyNeonToken(wrongIssuer), InvalidNeonTokenError);

    const expired = makeToken(privateKey, {
      iss: 'https://auth.example.test',
      aud: 'https://auth.example.test',
      sub: '860dc360-609f-4b7d-9e70-ec93fe6414d3',
      email: 'verified@example.test',
      emailVerified: true,
      iat: now - 1000,
      exp: now - 1,
    });
    await assert.rejects(() => verifyNeonToken(expired), InvalidNeonTokenError);

    const unverified = makeToken(privateKey, {
      iss: 'https://auth.example.test',
      aud: 'https://auth.example.test',
      sub: '860dc360-609f-4b7d-9e70-ec93fe6414d3',
      email: 'unverified@example.test',
      emailVerified: false,
      iat: now,
      exp: now + 900,
    });
    await assert.rejects(() => verifyNeonToken(unverified), InvalidNeonTokenError);
  } finally {
    global.fetch = previousFetch;
    if (previousBase === undefined) delete process.env.NEON_AUTH_BASE_URL;
    else process.env.NEON_AUTH_BASE_URL = previousBase;
    if (previousJwks === undefined) delete process.env.NEON_AUTH_JWKS_URL;
    else process.env.NEON_AUTH_JWKS_URL = previousJwks;
    resetJwksCacheForTests();
  }
});
