'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { Client } = require('pg');

test('forced RLS prevents one guest from reading or writing another guest conversation', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  const guestA = 'guest_' + randomBytes(24).toString('base64url');
  const guestB = 'guest_' + randomBytes(24).toString('base64url');
  const conversationA = randomUUID();
  const conversationB = randomUUID();
  const authA = randomUUID();
  const authB = randomUUID();
  const accountConversationA = randomUUID();
  const accountConversationB = randomUUID();
  try {
    await client.connect();
    const role = await client.query("SELECT 1 FROM pg_roles WHERE rolname = 'earth_app_runtime'");
    assert.equal(role.rowCount, 1, 'RLS runtime role must be created by migrations');

    await client.query('INSERT INTO neon_auth."user" (id) VALUES ($1), ($2)', [authA, authB]);
    await client.query(
      'INSERT INTO chat_conversations (id, anonymous_id, auth_user_id, lang) VALUES ($1, $2, NULL, $3), ($4, $5, NULL, $3), ($6, NULL, $7, $3), ($8, NULL, $9, $3)',
      [conversationA, guestA, 'en', conversationB, guestB, accountConversationA, authA, accountConversationB, authB]
    );
    await client.query(
      "INSERT INTO chat_messages (conversation_id, role, content) VALUES ($1, 'user', 'private A'), ($2, 'user', 'private B')",
      [conversationA, conversationB]
    );
    await client.query(
      "INSERT INTO chat_messages (conversation_id, role, content) VALUES ($1, 'user', 'account A'), ($2, 'user', 'account B')",
      [accountConversationA, accountConversationB]
    );

    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE earth_app_runtime');
    await client.query("SELECT set_config('app.auth_user_id', '', true), set_config('app.anonymous_id', $1, true), set_config('app.access_role', 'admin', true)", [guestA]);
    const conversations = await client.query('SELECT id FROM chat_conversations ORDER BY id');
    assert.deepEqual(conversations.rows.map(row => row.id), [conversationA]);

    const ownMessages = await client.query('SELECT content FROM chat_messages WHERE conversation_id = $1', [conversationA]);
    assert.deepEqual(ownMessages.rows.map(row => row.content), ['private A']);
    const foreignMessages = await client.query('SELECT content FROM chat_messages WHERE conversation_id = $1', [conversationB]);
    assert.equal(foreignMessages.rowCount, 0);

    const attemptedUpdate = await client.query('UPDATE chat_conversations SET stage = 7 WHERE id = $1', [conversationB]);
    assert.equal(attemptedUpdate.rowCount, 0);
    await assert.rejects(
      () => client.query("INSERT INTO chat_messages (conversation_id, role, content) VALUES ($1, 'user', 'forged')", [conversationB]),
      error => error && error.code === '42501'
    );
    await client.query('ROLLBACK');

    // Repeat the same isolation proof for authenticated Neon Auth identities.
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE earth_app_runtime');
    await client.query("SELECT set_config('app.auth_user_id', $1, true), set_config('app.anonymous_id', '', true), set_config('app.access_role', 'admin', true)", [authA]);
    const accountRows = await client.query('SELECT id FROM chat_conversations ORDER BY id');
    assert.deepEqual(accountRows.rows.map(row => row.id), [accountConversationA]);
    const accountPrivate = await client.query('SELECT content FROM chat_messages WHERE conversation_id = $1', [accountConversationA]);
    assert.deepEqual(accountPrivate.rows.map(row => row.content), ['account A']);
    const accountForeign = await client.query('SELECT content FROM chat_messages WHERE conversation_id = $1', [accountConversationB]);
    assert.equal(accountForeign.rowCount, 0);
    const accountUpdate = await client.query('UPDATE chat_conversations SET stage = 6 WHERE id = $1', [accountConversationB]);
    assert.equal(accountUpdate.rowCount, 0);
    await assert.rejects(
      () => client.query("INSERT INTO chat_messages (conversation_id, role, content) VALUES ($1, 'user', 'account forged')", [accountConversationB]),
      error => error && error.code === '42501'
    );
    await client.query('ROLLBACK');
  } finally {
    try { await client.query('ROLLBACK'); } catch {}
    try { await client.query('DELETE FROM chat_conversations WHERE id = ANY($1::uuid[])', [[conversationA, conversationB, accountConversationA, accountConversationB]]); } catch {}
    try { await client.query('DELETE FROM neon_auth."user" WHERE id = ANY($1::uuid[])', [[authA, authB]]); } catch {}
    await client.end();
  }
});
