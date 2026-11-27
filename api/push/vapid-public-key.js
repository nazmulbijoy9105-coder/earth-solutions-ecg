'use strict';

module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }
  const key = process.env.VAPID_PUBLIC;
  if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{87}$/.test(key) || Buffer.from(key, 'base64url').length !== 65 || typeof process.env.VAPID_PRIVATE !== 'string' || !process.env.VAPID_PRIVATE.trim() || process.env.VAPID_PRIVATE.includes('REPLACE')) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: 'Push notifications are not configured' }));
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.end(JSON.stringify({ key }));
};
