'use strict';

const database = require('../../lib/db.cjs');
const persistence = require('../../lib/persistence.cjs');
const { resolveCustomerIdentity } = require('../../lib/customer-identity.cjs');
const { isAllowedPushEndpoint } = require('../../lib/push-endpoint.cjs');

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
    return json(res, 503, { error: 'Push storage is not configured' });
  }

  const body = req.body || {};
  const subscription = body.subscription;
  if (!subscription || typeof subscription !== 'object' ||
      typeof subscription.endpoint !== 'string' || subscription.endpoint.length > 4096 ||
      !isAllowedPushEndpoint(subscription.endpoint) ||
      !subscription.keys || typeof subscription.keys.p256dh !== 'string' ||
      typeof subscription.keys.auth !== 'string' ||
      Buffer.byteLength(JSON.stringify(subscription)) > 8192) {
    return json(res, 400, { error: 'Invalid push subscription' });
  }
  let identity;
  try { identity = await resolveCustomerIdentity(req, res); } catch (error) { const status = error?.statusCode || 401; return json(res, status, { error: status === 503 ? 'Customer identity service is not configured' : status === 403 ? 'Untrusted request origin' : 'Invalid or unavailable customer identity' }); }
  try {
    await persistence.savePushSubscription({
      subscription,
      ...identity,
      stage: body.stage,
      lang: body.lang,
    });
    return json(res, 202, { accepted: true });
  } catch {
    return json(res, 503, { error: 'Push subscription storage unavailable' });
  }
};
