'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { healthCheck } = require('../lib/db.cjs');

test('readiness accepts only separate non-owner runtime and admin PostgreSQL logins with forced RLS', {
  skip: !process.env.DATABASE_URL || !process.env.ADMIN_DATABASE_URL || !process.env.TEST_DATABASE_OWNER_URL,
}, async () => {
  const runtimePool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const adminPool = new Pool({ connectionString: process.env.ADMIN_DATABASE_URL, max: 1 });
  try {
    assert.equal(await healthCheck({ runtimePool, adminPool }), true);
  } finally {
    await Promise.all([runtimePool.end(), adminPool.end()]);
  }
});
