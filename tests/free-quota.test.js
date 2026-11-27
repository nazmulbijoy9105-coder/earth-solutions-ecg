'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('daily free-message quota is atomic, idempotent and denies the eleventh unique message', async () => {
  const dbPath = require.resolve('../lib/db.cjs');
  const persistencePath = require.resolve('../lib/persistence.cjs');
  const originalDb = require(dbPath);
  const originalPersistence = require.cache[persistencePath];
  const usage = new Map();
  const client = {
    async query(sql, params = []) {
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 1 };
      if (sql.includes('INSERT INTO free_message_usage')) {
        const key = params[0] + ':' + params[1];
        if (usage.has(key)) return { rows: [], rowCount: 0 };
        usage.set(key, true);
        return { rows: [{ client_message_id: params[1] }], rowCount: 1 };
      }
      if (sql.includes('SELECT count(*)::int AS used')) {
        return { rows: [{ used: usage.size, retry_at: new Date(Date.now() + 86400000) }], rowCount: 1 };
      }
      if (sql.includes('DELETE FROM free_message_usage')) {
        usage.delete(params[0] + ':' + params[1]);
        return { rows: [], rowCount: 1 };
      }
      throw new Error('Unexpected SQL in quota test: ' + sql);
    },
  };

  require.cache[dbPath].exports = {
    ...originalDb,
    withTransaction: async work => work(client),
  };
  delete require.cache[persistencePath];
  const persistence = require('../lib/persistence.cjs');
  const userId = 'anon_123456789012345678901234';
  const ids = Array.from({ length: 11 }, (_, i) =>
    '123e4567-e89b-42d3-a456-' + String(i + 1).padStart(12, '0')
  );

  try {
    for (const messageId of ids.slice(0, 10)) {
      const result = await persistence.consumeDailyFreeQuota({ userId, messageId, dailyLimit: 10 });
      assert.equal(result.allowed, true);
    }
    const retry = await persistence.consumeDailyFreeQuota({ userId, messageId: ids[9], dailyLimit: 10 });
    assert.equal(retry.allowed, true);
    assert.equal(retry.used, 10);

    const eleventh = await persistence.consumeDailyFreeQuota({ userId, messageId: ids[10], dailyLimit: 10 });
    assert.equal(eleventh.allowed, false);
    assert.equal(eleventh.used, 10);
    assert.equal(usage.size, 10);

    await assert.rejects(
      () => persistence.consumeDailyFreeQuota({ userId: 'invalid', messageId: ids[0] }),
      /Valid guest and message identities are required/
    );
  } finally {
    require.cache[dbPath].exports = originalDb;
    delete require.cache[persistencePath];
    if (originalPersistence) require.cache[persistencePath] = originalPersistence;
  }
});
