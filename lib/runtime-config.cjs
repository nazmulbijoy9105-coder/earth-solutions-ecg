'use strict';

function validHttpsUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && Boolean(parsed.hostname) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function runtimeConfigurationIssues(env = process.env) {
  if (env.NODE_ENV !== 'production') return [];

  const issues = [];
  if (typeof env.GUEST_SESSION_SECRET !== 'string' || Buffer.byteLength(env.GUEST_SESSION_SECRET) < 32) {
    issues.push('GUEST_SESSION_SECRET');
  }
  if (!validHttpsUrl(env.NEON_AUTH_BASE_URL)) issues.push('NEON_AUTH_BASE_URL');
  if (env.NEON_AUTH_JWKS_URL && !validHttpsUrl(env.NEON_AUTH_JWKS_URL)) issues.push('NEON_AUTH_JWKS_URL');

  let origin;
  try {
    origin = new URL(env.ALLOWED_ORIGIN || '');
    if (origin.protocol !== 'https:' || origin.origin !== env.ALLOWED_ORIGIN || origin.username || origin.password) {
      issues.push('ALLOWED_ORIGIN');
    }
  } catch {
    issues.push('ALLOWED_ORIGIN');
  }

  if (typeof env.GROQ_API_KEY !== 'string' || env.GROQ_API_KEY.trim().length < 20 || env.GROQ_API_KEY.startsWith('REPLACE')) {
    issues.push('GROQ_API_KEY');
  }

  const hasVapidPublic = Boolean(env.VAPID_PUBLIC);
  const hasVapidPrivate = Boolean(env.VAPID_PRIVATE);
  if (hasVapidPublic !== hasVapidPrivate) issues.push('VAPID_PUBLIC/VAPID_PRIVATE');
  return issues;
}

module.exports = { runtimeConfigurationIssues };
