'use strict';

function isPlaceholder(value) {
  return typeof value !== 'string' || /^(?:replace|change[_-]?me|todo|example)(?:\b|[_-])/i.test(value.trim());
}

function validHttpsUrl(value) {
  if (isPlaceholder(value)) return false;
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    return !isPlaceholder(hostname) &&
      parsed.protocol === 'https:' &&
      Boolean(hostname) &&
      !parsed.username &&
      !parsed.password &&
      hostname !== 'localhost' &&
      !hostname.endsWith('.localhost') &&
      hostname !== '127.0.0.1' &&
      hostname !== '0.0.0.0' &&
      !hostname.endsWith('.example') &&
      !hostname.endsWith('.example.test') &&
      !hostname.endsWith('.test') &&
      !hostname.endsWith('.invalid');
  } catch {
    return false;
  }
}

function validVapidKey(value, expectedBytes) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) return false;
  try {
    return Buffer.from(value, 'base64url').length === expectedBytes;
  } catch {
    return false;
  }
}

function runtimeConfigurationIssues(env = process.env) {
  if (env.NODE_ENV !== 'production') return [];

  const issues = [];
  if (isPlaceholder(env.GUEST_SESSION_SECRET) || Buffer.byteLength(env.GUEST_SESSION_SECRET) < 32) {
    issues.push('GUEST_SESSION_SECRET');
  }
  if (!validHttpsUrl(env.NEON_AUTH_BASE_URL)) issues.push('NEON_AUTH_BASE_URL');
  if (env.NEON_AUTH_JWKS_URL && !validHttpsUrl(env.NEON_AUTH_JWKS_URL)) issues.push('NEON_AUTH_JWKS_URL');

  let origin;
  try {
    origin = new URL(env.ALLOWED_ORIGIN || '');
    if (!validHttpsUrl(env.ALLOWED_ORIGIN) || origin.protocol !== 'https:' || origin.origin !== env.ALLOWED_ORIGIN || origin.username || origin.password) {
      issues.push('ALLOWED_ORIGIN');
    }
  } catch {
    issues.push('ALLOWED_ORIGIN');
  }

  if (isPlaceholder(env.GROQ_API_KEY) || env.GROQ_API_KEY.trim().length < 20) {
    issues.push('GROQ_API_KEY');
  }

  const hasVapidPublic = Boolean(env.VAPID_PUBLIC);
  const hasVapidPrivate = Boolean(env.VAPID_PRIVATE);
  if (hasVapidPublic !== hasVapidPrivate ||
      (hasVapidPublic && (!validVapidKey(env.VAPID_PUBLIC, 65) || !validVapidKey(env.VAPID_PRIVATE, 32)))) {
    issues.push('VAPID_PUBLIC/VAPID_PRIVATE');
  }
  return issues;
}

module.exports = { runtimeConfigurationIssues, validVapidKey, validHttpsUrl };
