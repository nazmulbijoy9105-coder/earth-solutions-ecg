'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { healthCheck, closePool } = require('../lib/db.cjs');

test('readiness accepts only separate non-owner runtime and admin logins with forced RLS', {
  skip: !process.env.DATABASE_URL || !process.env.ADMIN_DATABASE_URL || !process.env.TEST_DATABASE_OWNER_URL,
}, async () => {
  try {
    assert.equal(await healthCheck(), true);
  } finally {
    await closePool();
  }
});
