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
    const role = await client.query(
      `SELECT rolname, rolcanlogin, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
       FROM pg_roles WHERE rolname IN ('earth_app_runtime', 'earth_app_admin') ORDER BY rolname`
    );
    assert.equal(role.rowCount, 2, 'both dedicated database group roles must exist');
    for (const row of role.rows) {
      assert.equal(row.rolcanlogin, false, row.rolname + ' must not be a login');
      assert.equal(row.rolsuper, false, row.rolname + ' must not be superuser');
      assert.equal(row.rolbypassrls, false, row.rolname + ' must not bypass RLS');
      assert.equal(row.rolcreatedb, false, row.rolname + ' must not create databases');
      assert.equal(row.rolcreaterole, false, row.rolname + ' must not create roles');
    }
    const ownership = await client.query(
      `SELECT count(*)::int AS count FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_roles r ON r.oid = c.relowner
       WHERE n.nspname = 'public' AND r.rolname IN ('earth_app_runtime', 'earth_app_admin')
         AND c.relkind IN ('r', 'p')`
    );
    assert.equal(ownership.rows[0].count, 0, 'neither group role may own application tables');
    const roleSeparation = await client.query(
      `SELECT pg_has_role('earth_app_runtime', 'earth_app_admin', 'MEMBER') AS runtime_is_admin,
              pg_has_role('earth_app_admin', 'earth_app_runtime', 'MEMBER') AS admin_is_runtime`
    );
    assert.equal(roleSeparation.rows[0].runtime_is_admin, false);
    assert.equal(roleSeparation.rows[0].admin_is_runtime, false);

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

    // A normal customer cannot self-assign an admin profile or forge a paid
    // payment state; payment callbacks/admin processing need the separate role.
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE earth_app_runtime');
    await client.query("SELECT set_config('app.auth_user_id', $1, true), set_config('app.anonymous_id', '', true)", [authA]);
    const denied = async (sql, params) => {
      await client.query('SAVEPOINT denied_attempt');
      await assert.rejects(() => client.query(sql, params), error => error && error.code === '42501');
      await client.query('ROLLBACK TO SAVEPOINT denied_attempt');
      await client.query('RELEASE SAVEPOINT denied_attempt');
    };
    await denied(
      "INSERT INTO app_user_profiles (auth_user_id, role, account_status) VALUES ($1, 'admin', 'active')",
      [authA]
    );
    await denied(
      "INSERT INTO payment_orders (order_reference, auth_user_id, provider, product_code, amount, status, idempotency_key) VALUES ($1, $2, 'bkash', 'test', 100, 'paid', $3)",
      ['order-' + randomUUID(), authA, 'idem-' + randomUUID()]
    );
    await denied(
      "INSERT INTO payment_events (payment_order_id, provider, provider_event_id, event_type, payload_sha256) VALUES ($1, 'bkash', $2, 'payment.success', repeat('a', 64))",
      [randomUUID(), 'event-' + randomUUID()]
    );
    await client.query('ROLLBACK');

    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE earth_app_admin');
    const adminRows = await client.query('SELECT id FROM chat_conversations WHERE id = ANY($1::uuid[]) ORDER BY id', [[conversationA, conversationB, accountConversationA, accountConversationB]]);
    assert.equal(adminRows.rowCount, 4, 'only the separate admin database role can read across customers');
    await client.query('ROLLBACK');
  } finally {
    try { await client.query('ROLLBACK'); } catch {}
    try { await client.query('DELETE FROM chat_conversations WHERE id = ANY($1::uuid[])', [[conversationA, conversationB, accountConversationA, accountConversationB]]); } catch {}
    try { await client.query('DELETE FROM neon_auth."user" WHERE id = ANY($1::uuid[])', [[authA, authB]]); } catch {}
    await client.end();
  }
});
