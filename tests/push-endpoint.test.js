'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isAllowedPushEndpoint, safePushTarget } = require('../lib/push-endpoint.cjs');

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
