'use strict';

const database = require('../../lib/db.cjs');
const persistence = require('../../lib/persistence.cjs');

const validGuestId = value => typeof value === 'string' && /^anon_[A-Za-z0-9_-]{16,100}$/.test(value);
const json = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(body));
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }
  const trustedOrigin = process.env.ALLOWED_ORIGIN;
  if (req.headers.origin && (!trustedOrigin || req.headers.origin !== trustedOrigin)) {
    return json(res, 403, { error: 'Untrusted origin' });
  }
  if (!database.isDatabaseConfigured()) {
    return json(res, 503, { error: 'Analytics storage is not configured' });
  }

  const body = req.body || {};
  const pathname = typeof body.path === 'string' ? body.path : '';
  if (!pathname.startsWith('/') || pathname.startsWith('//') || /[\\\r\n]/.test(pathname) || pathname.length > 500) {
    return json(res, 400, { error: 'Invalid page path' });
  }
  if (body.userId != null && !validGuestId(body.userId)) {
    return json(res, 400, { error: 'Invalid anonymous identity' });
  }
  try {
    await persistence.logPageview(pathname, body.referrer, { userId: body.userId });
    return json(res, 202, { accepted: true });
  } catch {
    return json(res, 503, { error: 'Analytics storage unavailable' });
  }
};
