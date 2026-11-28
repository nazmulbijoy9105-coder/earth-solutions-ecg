'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { runtimeConfigurationIssues } = require('../lib/runtime-config.cjs');

const validProductionEnv = () => ({
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://runtime:secret@db.neon.tech/app',
  ADMIN_DATABASE_URL: 'postgresql://admin:secret@db.neon.tech/app',
  GUEST_SESSION_SECRET: '0123456789abcdef0123456789abcdef',
  NEON_AUTH_BASE_URL: 'https://auth.neon.tech/project/auth',
  NEON_AUTH_JWKS_URL: 'https://auth.neon.tech/project/auth/.well-known/jwks.json',
  ALLOWED_ORIGIN: 'https://app.earthsolutions.com.bd',
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


test('production configuration rejects long placeholder secrets and example hosts', () => {
  const env = validProductionEnv();
  env.GUEST_SESSION_SECRET = 'REPLACE_WITH_A_REAL_RANDOM_SECRET_VALUE_123456789';
  env.NEON_AUTH_BASE_URL = 'https://auth.example.test/project/auth';
  env.ALLOWED_ORIGIN = 'https://app.example.test';
  assert.deepEqual(runtimeConfigurationIssues(env), [
    'GUEST_SESSION_SECRET',
    'NEON_AUTH_BASE_URL',
    'ALLOWED_ORIGIN',
  ]);
});

test('production configuration rejects malformed VAPID key material', () => {
  const env = validProductionEnv();
  env.VAPID_PUBLIC = 'not-a-valid-public-key';
  env.VAPID_PRIVATE = 'not-a-valid-private-key';
  assert.deepEqual(runtimeConfigurationIssues(env), ['VAPID_PUBLIC/VAPID_PRIVATE']);
});

test('valid VAPID key encodings use the expected uncompressed public and private lengths', () => {
  const env = validProductionEnv();
  env.VAPID_PUBLIC = Buffer.alloc(65, 4).toString('base64url');
  env.VAPID_PRIVATE = Buffer.alloc(32, 7).toString('base64url');
  assert.deepEqual(runtimeConfigurationIssues(env), []);
});


test('production readiness requires separate valid runtime and admin PostgreSQL URLs', () => {
  const env = validProductionEnv();
  delete env.ADMIN_DATABASE_URL;
  assert.deepEqual(runtimeConfigurationIssues(env), ['ADMIN_DATABASE_URL']);

  env.ADMIN_DATABASE_URL = 'postgresql://admin:secret@db.neon.tech/app';
  env.DATABASE_URL = 'postgres-evil://runtime:secret@db.neon.tech/app';
  assert.deepEqual(runtimeConfigurationIssues(env), ['DATABASE_URL']);
});
