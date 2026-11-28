'use strict';

const AUTH_PREFIX = '/api/neon-auth';
const MAX_RESPONSE_BYTES = 1024 * 1024;
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']);

function getAllowedOrigin(req) {
  const configured = process.env.ALLOWED_ORIGIN;
  if (!configured) return null;

  let incoming = req.headers.origin;
  if (!incoming && req.headers.referer) {
    try { incoming = new URL(req.headers.referer).origin; } catch { return null; }
  }
  if (!incoming && req.headers['sec-fetch-site'] === 'same-origin' && req.headers.host) {
    try {
      if (new URL(configured).host === req.headers.host) incoming = configured;
    } catch { return null; }
  }

  return incoming === configured ? configured : null;
}

function getTargetUrl(baseUrl, suffix, originalUrl) {
  const base = new URL(baseUrl);
  if (base.protocol !== 'https:') throw new Error('Neon Auth URL must use HTTPS');

  const cleanSuffix = String(suffix || '').replace(/^\/+|\/+$/g, '');
  const segments = cleanSuffix ? cleanSuffix.split('/') : [];
  if (segments.some(segment => !segment || segment === '.' || segment === '..' || segment.includes('\\'))) {
    throw new Error('Invalid authentication path');
  }

  const queryIndex = String(originalUrl || '').indexOf('?');
  const query = queryIndex >= 0 ? String(originalUrl).slice(queryIndex) : '';
  base.pathname = base.pathname.replace(/\/+$/, '') + (segments.length ? '/' + segments.map(encodeURIComponent).join('/') : '');
  base.search = query;
  base.hash = '';
  return base;
}

function rewriteCookie(cookie) {
  let value = String(cookie).replace(/;\s*Domain=[^;]*/ig, '');
  if (/;\s*Path=/i.test(value)) {
    value = value.replace(/;\s*Path=[^;]*/i, '; Path=' + AUTH_PREFIX);
  } else {
    value += '; Path=' + AUTH_PREFIX;
  }
  return value;
}

async function proxyNeonAuth(req, res, suffix) {
  if (!ALLOWED_METHODS.has(req.method)) {
    res.statusCode = 405;
    res.setHeader('Allow', [...ALLOWED_METHODS].join(', '));
    return res.end();
  }

  const origin = getAllowedOrigin(req);
  if (!origin) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }

  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  if (!baseUrl) {
    res.statusCode = 503;
    return res.end('Authentication service is not configured');
  }

  let target;
  try {
    target = getTargetUrl(baseUrl, suffix, req.originalUrl || req.url);
  } catch {
    res.statusCode = 400;
    return res.end('Invalid authentication request');
  }

  const headers = new Headers({
    Accept: req.headers.accept || 'application/json',
    Origin: origin,
    Referer: origin + '/',
  });
  if (req.headers['content-type']) headers.set('Content-Type', req.headers['content-type']);
  if (req.headers.cookie) headers.set('Cookie', req.headers.cookie);

  let body;
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.body !== undefined) {
    if (Buffer.isBuffer(req.body) || typeof req.body === 'string') body = req.body;
    else {
      body = JSON.stringify(req.body);
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    }
  }

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });

    const copyHeaders = ['content-type', 'cache-control', 'location', 'set-auth-jwt', 'www-authenticate', 'retry-after'];
    for (const name of copyHeaders) {
      const value = upstream.headers.get(name);
      if (value) res.setHeader(name, value);
    }

    const cookies = typeof upstream.headers.getSetCookie === 'function'
      ? upstream.headers.getSetCookie()
      : (upstream.headers.get('set-cookie') ? [upstream.headers.get('set-cookie')] : []);
    if (cookies.length) res.setHeader('Set-Cookie', cookies.map(rewriteCookie));

    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = upstream.status;
    if (upstream.status === 204 || upstream.status === 304) return res.end();

    const bytes = Buffer.from(await upstream.arrayBuffer());
    if (bytes.length > MAX_RESPONSE_BYTES) {
      res.statusCode = 502;
      return res.end('Authentication response exceeded the allowed size');
    }
    return res.end(bytes);
  } catch {
    res.statusCode = 502;
    return res.end('Authentication service temporarily unavailable');
  }
}

module.exports = proxyNeonAuth;
