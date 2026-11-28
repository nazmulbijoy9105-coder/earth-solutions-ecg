'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isAllowedPushEndpoint, isValidPushSubscription, isSafeStoredSubscription, safePushTarget } = require('../lib/push-endpoint.cjs');

test('accepts supported public browser push services only', () => {
  assert.equal(isAllowedPushEndpoint('https://fcm.googleapis.com/fcm/send/example'), true);
  assert.equal(isAllowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/example'), true);
  assert.equal(isAllowedPushEndpoint('https://web.push.apple.com/example'), true);
  assert.equal(isAllowedPushEndpoint('https://wns2.notify.windows.com/example'), true);
});

test('rejects arbitrary hosts, IP literals, local endpoints and non-HTTPS URLs', () => {
  for (const endpoint of [
    'https://127.0.0.1/admin',
    'https://localhost/private',
    'https://attacker.example/collect',
    'http://fcm.googleapis.com/fcm/send/example',
    'https://fcm.googleapis.com:8443/fcm/send/example',
    'https://user:pass@fcm.googleapis.com/fcm/send/example',
    'https://evil.push.apple.com.attacker.example/token',
  ]) assert.equal(isAllowedPushEndpoint(endpoint), false, endpoint);
});

test('push notification click targets cannot redirect off-site', () => {
  assert.equal(safePushTarget('/dashboard?tab=profile'), '/dashboard?tab=profile');
  assert.equal(safePushTarget('https://attacker.example/'), '/');
  assert.equal(safePushTarget('//attacker.example/'), '/');
  assert.equal(safePushTarget('/\\\\attacker.example/'), '/');
});


test('stored push record must have one matching validated endpoint in both columns', () => {
  const endpoint = 'https://fcm.googleapis.com/fcm/send/example';
  const keys = {
    p256dh: Buffer.alloc(65, 4).toString('base64url'),
    auth: Buffer.alloc(16, 7).toString('base64url'),
  };
  assert.equal(isValidPushSubscription({ endpoint, keys }), true);
  assert.equal(isSafeStoredSubscription({ endpoint, subscription: { endpoint, keys } }), true);
  assert.equal(isSafeStoredSubscription({
    endpoint,
    subscription: { endpoint: 'https://attacker.example/ssrf', keys: {} },
  }), false);
});


test('rejects subscriptions with malformed encryption key lengths', () => {
  const endpoint = 'https://fcm.googleapis.com/fcm/send/example';
  assert.equal(isValidPushSubscription({
    endpoint,
    keys: { p256dh: 'short', auth: 'short' },
  }), false);
});
