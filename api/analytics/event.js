'use strict';

const database = require('../../lib/db.cjs');
const persistence = require('../../lib/persistence.cjs');
const { resolveCustomerIdentity } = require('../../lib/customer-identity.cjs');

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
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const meta = body.meta && typeof body.meta === 'object' && !Array.isArray(body.meta) ? body.meta : {};
  if (!/^[a-zA-Z0-9_.:-]{1,100}$/.test(name) || Buffer.byteLength(JSON.stringify(meta)) > 4096) {
    return json(res, 400, { error: 'Invalid analytics event' });
  }
  let identity;
  try { identity = await resolveCustomerIdentity(req, res); } catch { return json(res, 401, { error: 'Invalid or unavailable customer identity' }); }

  try {
    await persistence.logEvent(name, meta, identity);
    return json(res, 202, { accepted: true });
  } catch {
    return json(res, 503, { error: 'Analytics storage unavailable' });
  }
};
