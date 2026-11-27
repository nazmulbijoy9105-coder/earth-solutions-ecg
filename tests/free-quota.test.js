'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('quota and user-message persistence are atomic and idempotent', async () => {
  const dbPath = require.resolve('../lib/db.cjs');
  const persistencePath = require.resolve('../lib/persistence.cjs');
  const originalDb = require(dbPath);
  const originalPersistence = require.cache[persistencePath];
  const usage = new Map();
  const messages = new Map();
  const owner = 'anon_123456789012345678901234';
  const conversationId = '223e4567-e89b-42d3-a456-426614174000';
  const client = {
    async query(sql, params = []) {
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [], rowCount: 1 };
      if (sql.includes('SELECT id FROM chat_conversations')) {
        return { rows: params[1] === owner ? [{ id: conversationId }] : [], rowCount: params[1] === owner ? 1 : 0 };
      }
      if (sql.includes('INSERT INTO free_message_usage')) {
        const key = params[0] + ':' + params[1];
        if (usage.has(key)) return { rows: [], rowCount: 0 };
        usage.set(key, { conversationId: params[2], contentHash: params[3] });
        return { rows: [{ client_message_id: params[1] }], rowCount: 1 };
      }
      if (sql.includes('SELECT conversation_id, content_sha256')) {
        const value = usage.get(params[0] + ':' + params[1]);
        return { rows: value ? [value] : [], rowCount: value ? 1 : 0 };
      }
      if (sql.includes('SELECT count(*)::int AS used')) {
        return { rows: [{ used: usage.size, retry_at: new Date(Date.now() + 86400000) }], rowCount: 1 };
      }
      if (sql.includes('DELETE FROM free_message_usage')) {
        usage.delete(params[0] + ':' + params[1]);
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('INSERT INTO chat_messages')) {
        messages.set(params[1], params[2]);
        return { rows: [], rowCount: 1 };
      }
      if (sql.includes('UPDATE chat_conversations')) return { rows: [], rowCount: 1 };
      throw new Error('Unexpected SQL in quota test: ' + sql);
    },
  };

  require.cache[dbPath].exports = {
    ...originalDb,
    withTransaction: async work => work(client),
  };
  delete require.cache[persistencePath];
  const persistence = require('../lib/persistence.cjs');
  const ids = Array.from({ length: 11 }, (_, i) =>
    '123e4567-e89b-42d3-a456-' + String(i + 1).padStart(12, '0')
  );

  try {
    for (const messageId of ids.slice(0, 10)) {
      const result = await persistence.appendUserMessageWithQuota({
        conversationId, anonymousId: owner, messageId, content: 'hello', dailyLimit: 10,
      });
      assert.equal(result.allowed, true);
    }
    const retry = await persistence.appendUserMessageWithQuota({
      conversationId, anonymousId: owner, messageId: ids[9], content: 'hello', dailyLimit: 10,
    });
    assert.equal(retry.allowed, true);
    assert.equal(retry.duplicate, true);
    assert.equal(retry.used, 10);
    await assert.rejects(
      () => persistence.appendUserMessageWithQuota({
        conversationId, anonymousId: owner, messageId: ids[9], content: 'changed payload', dailyLimit: 10,
      }),
      /Message identity was already used/
    );
    await assert.rejects(
      () => persistence.appendUserMessageWithQuota({
        conversationId: '323e4567-e89b-42d3-a456-426614174000',
        anonymousId: owner, messageId: ids[9], content: 'hello', dailyLimit: 10,
      }),
      /Message identity was already used/
    );

    const eleventh = await persistence.appendUserMessageWithQuota({
      conversationId, anonymousId: owner, messageId: ids[10], content: 'eleventh', dailyLimit: 10,
    });
    assert.equal(eleventh.allowed, false);
    assert.equal(eleventh.used, 10);
    assert.equal(usage.size, 10);
    assert.equal(messages.size, 10);

    await assert.rejects(
      () => persistence.appendUserMessageWithQuota({
        conversationId, anonymousId: 'invalid', messageId: ids[0], content: 'forged',
      }),
      /Valid conversation, guest, message and content are required/
    );
  } finally {
    require.cache[dbPath].exports = originalDb;
    delete require.cache[persistencePath];
    if (originalPersistence) require.cache[persistencePath] = originalPersistence;
  }
});
