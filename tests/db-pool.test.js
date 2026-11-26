'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const database = require('../lib/db.cjs');

test('Neon PostgreSQL pool is lazily constructed and can be closed without connecting', async () => {
  const previous = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/peopole_test?sslmode=disable';
  try {
    const pool = database.getPool();
    assert.equal(typeof pool.query, 'function');
    assert.equal(typeof pool.connect, 'function');
    await database.closePool();
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});
