'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { runtimeConfigurationIssues } = require('../lib/runtime-config.cjs');

const validProductionEnv = () => ({
  NODE_ENV: 'production',
  GUEST_SESSION_SECRET: '0123456789abcdef0123456789abcdef',
  NEON_AUTH_BASE_URL: 'https://auth.example.test/project/auth',
  NEON_AUTH_JWKS_URL: 'https://auth.example.test/project/auth/.well-known/jwks.json',
  ALLOWED_ORIGIN: 'https://app.example.test',
  GROQ_API_KEY: 'gsk_' + 'x'.repeat(40),
  VAPID_PUBLIC: '',
  VAPID_PRIVATE: '',
});

test('production runtime configuration accepts complete required settings', () => {
  assert.deepEqual(runtimeConfigurationIssues(validProductionEnv()), []);
});

test('production runtime configuration fails closed for missing required secrets and unsafe origin', () => {
  const env = validProductionEnv();
  delete env.GUEST_SESSION_SECRET;
  env.ALLOWED_ORIGIN = 'http://app.example.test/path';
  env.GROQ_API_KEY = 'REPLACE_ME';
  assert.deepEqual(runtimeConfigurationIssues(env), [
    'GUEST_SESSION_SECRET',
    'ALLOWED_ORIGIN',
    'GROQ_API_KEY',
  ]);
});

test('production runtime configuration rejects partial VAPID configuration', () => {
  const env = validProductionEnv();
  env.VAPID_PUBLIC = 'public';
  assert.deepEqual(runtimeConfigurationIssues(env), ['VAPID_PUBLIC/VAPID_PRIVATE']);
});

test('non-production runtime does not block local development configuration', () => {
  assert.deepEqual(runtimeConfigurationIssues({ NODE_ENV: 'development' }), []);
});
