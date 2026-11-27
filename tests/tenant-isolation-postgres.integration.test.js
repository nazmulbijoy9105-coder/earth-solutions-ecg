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
  try {
    await client.connect();
    const role = await client.query("SELECT 1 FROM pg_roles WHERE rolname = 'earth_app_runtime'");
    assert.equal(role.rowCount, 1, 'RLS runtime role must be created by migrations');

    await client.query(
      'INSERT INTO chat_conversations (id, anonymous_id, lang) VALUES ($1, $2, $3), ($4, $5, $3)',
      [conversationA, guestA, 'en', conversationB, guestB]
    );
    await client.query(
      "INSERT INTO chat_messages (conversation_id, role, content) VALUES ($1, 'user', 'private A'), ($2, 'user', 'private B')",
      [conversationA, conversationB]
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
  } finally {
    try { await client.query('ROLLBACK'); } catch {}
    try { await client.query('DELETE FROM chat_conversations WHERE id = ANY($1::uuid[])', [[conversationA, conversationB]]); } catch {}
    await client.end();
  }
});
