'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getTrustedClientIp } = require('../lib/client-ip.cjs');

test('trusted client IP ignores a client-supplied X-Forwarded-For header', () => {
  assert.equal(getTrustedClientIp({
    headers: { 'x-forwarded-for': '198.51.100.77' },
    socket: { remoteAddress: '203.0.113.9' },
  }), '203.0.113.9');
});

test('Express-resolved req.ip takes precedence over raw forwarding headers', () => {
  assert.equal(getTrustedClientIp({
    ip: '203.0.113.10',
    headers: { 'x-forwarded-for': '198.51.100.77' },
    socket: { remoteAddress: '127.0.0.1' },
  }), '203.0.113.10');
});
