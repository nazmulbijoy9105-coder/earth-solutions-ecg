'use strict';

const crypto = require('node:crypto');
const { verifyNeonToken } = require('./neon-auth.cjs');

const COOKIE = 'ecg_guest';
const TTL_SECONDS = 30 * 24 * 60 * 60;

function secret() {
  const value = process.env.GUEST_SESSION_SECRET || '';
  if (Buffer.byteLength(value) < 32) throw new Error('GUEST_SESSION_SECRET must contain at least 32 bytes');
  return value;
}
function signature(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}
function cookieValue(header) {
  for (const part of String(header || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0 || part.slice(0, index).trim() !== COOKIE) continue;
    try { return decodeURIComponent(part.slice(index + 1).trim()); } catch { return null; }
  }
  return null;
}
function verifyGuest(value) {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  const [id, expiry, suppliedSignature] = parts;
  if (!/^guest_[A-Za-z0-9_-]{32,80}$/.test(id) || !/^\d+$/.test(expiry) || Number(expiry) <= Math.floor(Date.now() / 1000)) return null;
  const expected = Buffer.from(signature(id + '.' + expiry));
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
  return id;
}
function issueGuest(res, id) {
  const expiry = String(Math.floor(Date.now() / 1000) + TTL_SECONDS);
  const payload = id + '.' + expiry;
  const token = payload + '.' + signature(payload);
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', COOKIE + '=' + encodeURIComponent(token) + '; HttpOnly; SameSite=Lax; Path=/api; Max-Age=' + TTL_SECONDS + secure);
}
async function resolveCustomerIdentity(req, res) {
  const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
  if (bearer) {
    const user = await verifyNeonToken(bearer[1]);
    return { authUserId: user.id, anonymousId: null, ownerId: user.id };
  }
  let id = verifyGuest(cookieValue(req.headers.cookie));
  if (!id) {
    id = 'guest_' + crypto.randomBytes(24).toString('base64url');
    issueGuest(res, id);
  }
  return { authUserId: null, anonymousId: id, ownerId: id };
}
async function requireCustomerIdentity(req, res, next) {
  try {
    req.identity = await resolveCustomerIdentity(req, res);
    return next();
  } catch (error) {
    const status = error && error.message === 'GUEST_SESSION_SECRET must contain at least 32 bytes' ? 503 : 401;
    return res.status(status).json({ error: status === 503 ? 'Guest identity service is not configured' : 'Invalid or expired customer session' });
  }
}

module.exports = { resolveCustomerIdentity, requireCustomerIdentity };
