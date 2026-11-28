'use strict';

const ALLOWED_HOSTS = [
  'fcm.googleapis.com',
  'push.services.mozilla.com',
  'web.push.apple.com',
];

function isAllowedPushEndpoint(value) {
  if (typeof value !== 'string' || value.length > 4096) return false;
  try {
    const endpoint = new URL(value);
    const host = endpoint.hostname.toLowerCase();
    const trustedHost = ALLOWED_HOSTS.includes(host) ||
      host.endsWith('.push.services.mozilla.com') ||
      host.endsWith('.push.apple.com') ||
      host.endsWith('.notify.windows.com');
    return endpoint.protocol === 'https:' &&
      trustedHost &&
      !endpoint.username &&
      !endpoint.password &&
      (!endpoint.port || endpoint.port === '443') &&
      Boolean(endpoint.pathname && endpoint.pathname !== '/');
  } catch {
    return false;
  }
}

function safePushTarget(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
  try {
    const target = new URL(value, 'https://app.invalid');
    if (target.origin !== 'https://app.invalid') return '/';
    return target.pathname + target.search + target.hash;
  } catch {
    return '/';
  }
}

module.exports = { isAllowedPushEndpoint, safePushTarget };
