'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes, createHash } = require('node:crypto');
const { Client } = require('pg');

test('forced RLS prevents one guest from reading or writing another guest conversation', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const client = new Client({ connectionString: process.env.TEST_DATABASE_OWNER_URL || process.env.DATABASE_URL });
  const guestA = 'guest_' + randomBytes(24).toString('base64url');
  const guestB = 'guest_' + randomBytes(24).toString('base64url');
  const conversationA = randomUUID();
  const conversationB = randomUUID();
  const authA = randomUUID();
  const authB = randomUUID();
  const accountConversationA = randomUUID();
  const accountConversationB = randomUUID();
  const quotaMessageIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const rateKeyA = createHash('sha256').update('guest:' + guestA).digest('hex');
  const rateKeyB = createHash('sha256').update('guest:' + guestB).digest('hex');
  try {
    await client.connect();
    const role = await client.query(
      `SELECT rolname, rolcanlogin, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
       FROM pg_roles WHERE rolname IN ('earth_app_owner', 'earth_app_runtime', 'earth_app_admin') ORDER BY rolname`
    );
    assert.equal(role.rowCount, 3, 'owner, runtime and admin group roles must exist');
    for (const row of role.rows) {
      assert.equal(row.rolcanlogin, false, row.rolname + ' must not be a login');
      assert.equal(row.rolsuper, false, row.rolname + ' must not be superuser');
      assert.equal(row.rolbypassrls, false, row.rolname + ' must not bypass RLS');
      assert.equal(row.rolcreatedb, false, row.rolname + ' must not create databases');
      assert.equal(row.rolcreaterole, false, row.rolname + ' must not create roles');
    }
    const requiredTables = [
      'app_user_profiles', 'legacy_account_imports', 'chat_conversations',
      'chat_messages', 'payment_orders', 'payment_events', 'immigration_sources',
      'immigration_source_versions', 'immigration_source_reviews', 'audit_events',
      'app_inquiries', 'app_analytics_events', 'app_push_subscriptions',
      'api_rate_limits', 'free_message_usage',
    ];
    const ownership = await client.query(
      `SELECT count(*)::int AS count FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_roles r ON r.oid = c.relowner
       WHERE n.nspname = 'public' AND r.rolname = 'earth_app_owner'
         AND c.relname = ANY($1::text[]) AND c.relkind IN ('r', 'p')`,
      [requiredTables]
    );
    assert.equal(ownership.rows[0].count, requiredTables.length, 'all application tables must belong to the dedicated owner role');
    const rls = await client.query(
      `SELECT names.table_name, c.relrowsecurity, c.relforcerowsecurity,
              count(p.policyname)::int AS policies
       FROM unnest($1::text[]) AS names(table_name)
       LEFT JOIN pg_namespace n ON n.nspname = 'public'
       LEFT JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = names.table_name
       LEFT JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = names.table_name
       GROUP BY names.table_name, c.relrowsecurity, c.relforcerowsecurity`,
      [requiredTables]
    );
    assert.equal(rls.rowCount, requiredTables.length, 'every application table must exist');
    for (const row of rls.rows) {
      assert.equal(row.relrowsecurity, true, row.table_name + ' must enable RLS');
      assert.equal(row.relforcerowsecurity, true, row.table_name + ' must force RLS');
      assert.ok(row.policies > 0, row.table_name + ' must have at least one explicit policy');
    }
    const roleSeparation = await client.query(
      `SELECT pg_has_role('earth_app_runtime', 'earth_app_admin', 'MEMBER') AS runtime_is_admin,
              pg_has_role('earth_app_admin', 'earth_app_runtime', 'MEMBER') AS admin_is_runtime`
    );
    assert.equal(roleSeparation.rows[0].runtime_is_admin, false);
    assert.equal(roleSeparation.rows[0].admin_is_runtime, false);

    await client.query(
      'INSERT INTO neon_auth."user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, false), ($4, $5, $6, false)',
      [authA, 'Isolation Test A', 'isolation-a-' + authA + '@example.invalid', authB, 'Isolation Test B', 'isolation-b-' + authB + '@example.invalid']
    );
    await client.query('INSERT INTO app_user_profiles (auth_user_id) VALUES ($1), ($2)', [authA, authB]);
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
    await client.query(
      `INSERT INTO free_message_usage (anonymous_id, auth_user_id, client_message_id, conversation_id, content_sha256)
       VALUES ($1, NULL, $2, $3, repeat('a', 64)), ($4, NULL, $5, $6, repeat('b', 64)),
              (NULL, $7, $8, $9, repeat('c', 64)), (NULL, $10, $11, $12, repeat('d', 64))`,
      [guestA, quotaMessageIds[0], conversationA, guestB, quotaMessageIds[1], conversationB,
       authA, quotaMessageIds[2], accountConversationA, authB, quotaMessageIds[3], accountConversationB]
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
    const guestQuota = await client.query('SELECT client_message_id FROM free_message_usage ORDER BY client_message_id');
    assert.deepEqual(guestQuota.rows.map(row => row.client_message_id), [quotaMessageIds[0]]);
    const foreignGuestQuota = await client.query('SELECT client_message_id FROM free_message_usage WHERE client_message_id = $1', [quotaMessageIds[1]]);
    assert.equal(foreignGuestQuota.rowCount, 0);

    const attemptedUpdate = await client.query('UPDATE chat_conversations SET stage = 7 WHERE id = $1', [conversationB]);
    assert.equal(attemptedUpdate.rowCount, 0);
    await assert.rejects(
      () => client.query("INSERT INTO chat_messages (conversation_id, role, content) VALUES ($1, 'user', 'forged')", [conversationB]),
      error => error && error.code === '42501'
    );
    await client.query('ROLLBACK');

    await client.query(
      'INSERT INTO api_rate_limits (bucket_key, window_start, request_count) VALUES ($1, now(), 1), ($2, now(), 1)',
      [rateKeyA, rateKeyB]
    );
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE earth_app_runtime');
    await client.query(
      "SELECT set_config('app.anonymous_id', $1, true), set_config('app.auth_user_id', '', true), set_config('app.rate_limit_key_1', $2, true), set_config('app.rate_limit_key_2', '', true)",
      [guestA, rateKeyA]
    );
    const ownBuckets = await client.query('SELECT bucket_key FROM api_rate_limits');
    assert.deepEqual(ownBuckets.rows.map(row => row.bucket_key.trim()), [rateKeyA]);
    const foreignBuckets = await client.query('SELECT bucket_key FROM api_rate_limits WHERE bucket_key = $1', [rateKeyB]);
    assert.equal(foreignBuckets.rowCount, 0);
    await client.query('ROLLBACK');

    // Repeat the same isolation proof for authenticated Neon Auth identities.
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE earth_app_runtime');
    await client.query("SELECT set_config('app.auth_user_id', $1, true), set_config('app.anonymous_id', '', true), set_config('app.access_role', 'admin', true)", [authA]);
    const accountRows = await client.query('SELECT id FROM chat_conversations ORDER BY id');
    assert.deepEqual(accountRows.rows.map(row => row.id), [accountConversationA]);
    const accountPrivate = await client.query('SELECT content FROM chat_messages WHERE conversation_id = $1', [accountConversationA]);
    assert.deepEqual(accountPrivate.rows.map(row => row.content), ['account A']);
    const ownProfile = await client.query('SELECT auth_user_id FROM app_user_profiles');
    assert.deepEqual(ownProfile.rows.map(row => row.auth_user_id), [authA]);
    const foreignProfile = await client.query('SELECT auth_user_id FROM app_user_profiles WHERE auth_user_id = $1', [authB]);
    assert.equal(foreignProfile.rowCount, 0);
    const ownQuota = await client.query('SELECT client_message_id FROM free_message_usage');
    assert.deepEqual(ownQuota.rows.map(row => row.client_message_id), [quotaMessageIds[2]]);
    const foreignQuota = await client.query('SELECT client_message_id FROM free_message_usage WHERE client_message_id = $1', [quotaMessageIds[3]]);
    assert.equal(foreignQuota.rowCount, 0);
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
    const adminProfiles = await client.query('SELECT auth_user_id FROM app_user_profiles WHERE auth_user_id = ANY($1::uuid[])', [[authA, authB]]);
    assert.equal(adminProfiles.rowCount, 2, 'admin role can access all customer profiles');
    const adminQuota = await client.query('SELECT client_message_id FROM free_message_usage WHERE client_message_id = ANY($1::uuid[])', [quotaMessageIds]);
    assert.equal(adminQuota.rowCount, 4, 'admin role can access all customer quota rows');
    await client.query('ROLLBACK');
  } finally {
    try { await client.query('ROLLBACK'); } catch {}
    try { await client.query('DELETE FROM api_rate_limits WHERE bucket_key = ANY($1::char(64)[])', [[rateKeyA, rateKeyB]]); } catch {}
    try { await client.query('DELETE FROM free_message_usage WHERE client_message_id = ANY($1::uuid[])', [quotaMessageIds]); } catch {}
    try { await client.query('DELETE FROM chat_conversations WHERE id = ANY($1::uuid[])', [[conversationA, conversationB, accountConversationA, accountConversationB]]); } catch {}
    try { await client.query('DELETE FROM app_user_profiles WHERE auth_user_id = ANY($1::uuid[])', [[authA, authB]]); } catch {}
    try { await client.query('DELETE FROM neon_auth."user" WHERE id = ANY($1::uuid[])', [[authA, authB]]); } catch {}
    await client.end();
  }
});
