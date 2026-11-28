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

function validBase64UrlBytes(value, expectedBytes) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) return false;
  try {
    return Buffer.from(value, 'base64url').length === expectedBytes;
  } catch {
    return false;
  }
}

function isValidPushSubscription(subscription) {
  return Boolean(subscription &&
    typeof subscription === 'object' &&
    isAllowedPushEndpoint(subscription.endpoint) &&
    subscription.keys &&
    validBase64UrlBytes(subscription.keys.p256dh, 65) &&
    validBase64UrlBytes(subscription.keys.auth, 16));
}

function isSafeStoredSubscription(record) {
  return Boolean(record &&
    record.subscription &&
    typeof record.subscription === 'object' &&
    record.endpoint === record.subscription.endpoint &&
    isValidPushSubscription(record.subscription));
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

module.exports = { isAllowedPushEndpoint, isValidPushSubscription, isSafeStoredSubscription, safePushTarget };
