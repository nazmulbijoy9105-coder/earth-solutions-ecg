'use strict';

const crypto = require('node:crypto');

class AuthConfigurationError extends Error {}
class AuthProviderUnavailableError extends Error {}
class InvalidNeonTokenError extends Error {}

let jwksCache = null;
let jwksExpiresAt = 0;

function getAuthConfig() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  if (!baseUrl) throw new AuthConfigurationError('NEON_AUTH_BASE_URL is not configured');

  let parsed;
  try { parsed = new URL(baseUrl); } catch { throw new AuthConfigurationError('NEON_AUTH_BASE_URL is invalid'); }
  if (parsed.protocol !== 'https:') throw new AuthConfigurationError('Neon Auth must use HTTPS');

  const jwksUrl = process.env.NEON_AUTH_JWKS_URL || baseUrl.replace(/\/+$/, '') + '/.well-known/jwks.json';
  return { jwksUrl, issuer: parsed.origin };
}

async function getJwks(forceRefresh = false) {
  const config = getAuthConfig();
  if (!forceRefresh && jwksCache && Date.now() < jwksExpiresAt) return jwksCache;

  let response;
  try {
    response = await fetch(config.jwksUrl, { signal: AbortSignal.timeout(5000) });
  } catch {
    throw new AuthProviderUnavailableError('Unable to retrieve Neon Auth signing keys');
  }
  if (!response.ok) throw new AuthProviderUnavailableError('Neon Auth signing keys are unavailable');

  let document;
  try { document = await response.json(); } catch { throw new AuthProviderUnavailableError('Neon Auth returned invalid signing keys'); }
  if (!document || !Array.isArray(document.keys) || document.keys.length === 0) {
    throw new AuthProviderUnavailableError('Neon Auth returned no signing keys');
  }

  jwksCache = document.keys;
  jwksExpiresAt = Date.now() + 5 * 60 * 1000;
  return jwksCache;
}

function decodeSegment(segment) {
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
  } catch {
    throw new InvalidNeonTokenError('Malformed token');
  }
}

async function verifyNeonToken(token) {
  if (typeof token !== 'string' || token.length > 8192) throw new InvalidNeonTokenError('Invalid token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new InvalidNeonTokenError('Malformed token');

  const header = decodeSegment(parts[0]);
  const claims = decodeSegment(parts[1]);
  if (header.alg !== 'EdDSA' || typeof header.kid !== 'string') {
    throw new InvalidNeonTokenError('Unsupported token algorithm');
  }

  const config = getAuthConfig();
  let keys = await getJwks();
  let jwk = keys.find(key => key.kid === header.kid && key.kty === 'OKP' && key.crv === 'Ed25519');
  if (!jwk) {
    keys = await getJwks(true);
    jwk = keys.find(key => key.kid === header.kid && key.kty === 'OKP' && key.crv === 'Ed25519');
  }
  if (!jwk || (jwk.use && jwk.use !== 'sig') || (Array.isArray(jwk.key_ops) && !jwk.key_ops.includes('verify'))) {
    throw new InvalidNeonTokenError('Signing key not found');
  }

  let validSignature = false;
  try {
    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    validSignature = crypto.verify(
      null,
      Buffer.from(parts[0] + '.' + parts[1]),
      publicKey,
      Buffer.from(parts[2], 'base64url')
    );
  } catch {
    throw new InvalidNeonTokenError('Invalid token signature');
  }
  if (!validSignature) throw new InvalidNeonTokenError('Invalid token signature');

  const now = Math.floor(Date.now() / 1000);
  const audienceValid = claims.aud === config.issuer ||
    (Array.isArray(claims.aud) && claims.aud.includes(config.issuer));

  if (
    claims.iss !== config.issuer ||
    !audienceValid ||
    typeof claims.sub !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(claims.sub) ||
    !Number.isFinite(claims.exp) ||
    claims.exp <= now ||
    (Number.isFinite(claims.nbf) && claims.nbf > now) ||
    (Number.isFinite(claims.iat) && claims.iat > now + 60) ||
    claims.emailVerified !== true ||
    claims.banned === true
  ) {
    throw new InvalidNeonTokenError('Token claims are invalid');
  }

  return {
    id: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : null,
    name: typeof claims.name === 'string' ? claims.name : null,
    emailVerified: true,
  };
}

function requireNeonAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return res.status(401).json({ error: 'Authentication required' });

  verifyNeonToken(match[1]).then(user => {
    req.auth = user;
    next();
  }).catch(error => {
    if (error instanceof AuthConfigurationError || error instanceof AuthProviderUnavailableError) {
      return res.status(503).json({ error: 'Authentication service unavailable' });
    }
    return res.status(401).json({ error: 'Invalid or expired session' });
  });
}

function resetJwksCacheForTests() {
  jwksCache = null;
  jwksExpiresAt = 0;
}

module.exports = { verifyNeonToken, requireNeonAuth, resetJwksCacheForTests, AuthConfigurationError, AuthProviderUnavailableError, InvalidNeonTokenError };
