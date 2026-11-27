'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');

test('PostgreSQL serializes concurrent guest quota consumption and rejects message replay', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const dbPath = require.resolve('../lib/db.cjs');
  const persistencePath = require.resolve('../lib/persistence.cjs');
  const originalDb = require(dbPath);
  const originalPersistence = require.cache[persistencePath];
  let owner;
  const withRealTransaction = async work => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.anonymous_id', $1, true), set_config('app.auth_user_id', '', true)", [owner]);
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try { await client.query('ROLLBACK'); } catch {}
      throw error;
    } finally {
      await client.end();
    }
  };

  require.cache[dbPath].exports = { ...originalDb, withTransaction: withRealTransaction };
  delete require.cache[persistencePath];
  const persistence = require('../lib/persistence.cjs');
  owner = 'guest_' + randomUUID().replace(/-/g, '');
  const conversationId = randomUUID();
  const otherConversationId = randomUUID();
  const ids = Array.from({ length: 12 }, () => randomUUID());
  const setup = new Client({ connectionString: process.env.DATABASE_URL });

  try {
    await setup.connect();
    await setup.query(
      'INSERT INTO chat_conversations (id, anonymous_id, lang) VALUES ($1, $2, $3), ($4, $2, $3)',
      [conversationId, owner, 'en', otherConversationId]
    );

    const results = await Promise.all(ids.map(messageId =>
      persistence.appendUserMessageWithQuota({
        conversationId, anonymousId: owner, messageId, content: 'concurrent message', dailyLimit: 10,
      })
    ));
    assert.equal(results.filter(result => result.allowed && !result.duplicate).length, 10);
    assert.equal(results.filter(result => !result.allowed).length, 2);

    const usage = await setup.query(
      'SELECT count(*)::int AS count FROM free_message_usage WHERE anonymous_id = $1 AND usage_date = (now() AT TIME ZONE \'UTC\')::date',
      [owner]
    );
    const messages = await setup.query(
      'SELECT count(*)::int AS count FROM chat_messages WHERE conversation_id = $1 AND role = \'user\'',
      [conversationId]
    );
    assert.equal(usage.rows[0].count, 10);
    assert.equal(messages.rows[0].count, 10);

    const acceptedIndex = results.findIndex(result => result.allowed && !result.duplicate);
    const acceptedMessageId = ids[acceptedIndex];
    const retry = await persistence.appendUserMessageWithQuota({
      conversationId, anonymousId: owner, messageId: acceptedMessageId, content: 'concurrent message', dailyLimit: 10,
    });
    assert.equal(retry.duplicate, true);

    await assert.rejects(
      () => persistence.appendUserMessageWithQuota({
        conversationId: otherConversationId,
        anonymousId: owner,
        messageId: acceptedMessageId,
        content: 'concurrent message',
        dailyLimit: 10,
      }),
      /Message identity was already used/
    );
  } finally {
    if (setup._connected) {
      await setup.query('DELETE FROM chat_conversations WHERE id = ANY($1::uuid[])', [[conversationId, otherConversationId]]);
      await setup.end();
    }
    require.cache[dbPath].exports = originalDb;
    delete require.cache[persistencePath];
    if (originalPersistence) require.cache[persistencePath] = originalPersistence;
  }
});
