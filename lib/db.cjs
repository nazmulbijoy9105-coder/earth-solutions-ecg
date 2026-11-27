'use strict';

const { Pool, neonConfig } = require('@neondatabase/serverless');

let pool;

function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres'));
}

function getPool() {
  if (!isDatabaseConfigured()) {
    throw new Error('DATABASE_URL is required for PostgreSQL persistence');
  }

  if (!pool) {
    if (typeof globalThis.WebSocket === 'function') {
      neonConfig.webSocketConstructor = globalThis.WebSocket;
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    pool.on('error', () => {
      // Do not log connection strings or query parameters.
      process.stderr.write('[database] idle connection error\n');
    });
  }
  return pool;
}

async function query(text, params = []) {
  return getPool().query(text, params);
}

async function withTransaction(work) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally {
    client.release();
  }
}

async function healthCheck() {
  const requiredTables = [
    'app_user_profiles',
    'legacy_account_imports',
    'chat_conversations',
    'chat_messages',
    'payment_orders',
    'payment_events',
    'immigration_sources',
    'immigration_source_versions',
    'immigration_source_reviews',
    'audit_events',
    'app_inquiries',
    'app_analytics_events',
    'app_push_subscriptions',
    'api_rate_limits',
    'free_message_usage',
  ];
  const result = await query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [requiredTables]
  );
  const present = new Set(result.rows.map(row => row.table_name));
  const missing = requiredTables.filter(name => !present.has(name));
  if (missing.length) throw new Error('Required application schema is missing');

  // A migration-created application schema is mandatory. A manually-created
  // partial schema must never be mistaken for a deployable production database.
  const ledger = await query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'pgmigrations'
     ) AS present`
  );
  if (!ledger.rows[0]?.present) throw new Error('Migration ledger is missing');

  // The web process must not connect as a superuser or a BYPASSRLS role.
  const role = await query(
    `SELECT current_database() AS database_name, current_user AS role_name,
            r.rolsuper, r.rolbypassrls
     FROM pg_roles r WHERE r.rolname = current_user`
  );
  if (!role.rows[0] || role.rows[0].rolsuper || role.rows[0].rolbypassrls) {
    throw new Error('Database runtime role is not least-privileged');
  }

  // These tables contain customer/tenant-owned data. Require forced RLS,
  // at least one policy, and a runtime role that does not own the table.
  // This is a fail-closed readiness gate, not proof that policy predicates
  // are correct; cross-tenant integration tests remain mandatory.
  const tenantTables = [
    'app_user_profiles',
    'legacy_account_imports',
    'chat_conversations',
    'chat_messages',
    'payment_orders',
    'payment_events',
    'audit_events',
    'app_inquiries',
    'app_analytics_events',
    'app_push_subscriptions',
    'api_rate_limits',
    'free_message_usage',
  ];
  const isolation = await query(
    `SELECT names.table_name,
            c.relrowsecurity AS rls_enabled,
            c.relforcerowsecurity AS rls_forced,
            (c.relowner = r.oid) AS runtime_is_owner,
            count(p.policyname)::int AS policy_count
     FROM unnest($1::text[]) AS names(table_name)
     LEFT JOIN pg_namespace n ON n.nspname = 'public'
     LEFT JOIN pg_class c ON c.relnamespace = n.oid
                           AND c.relname = names.table_name
                           AND c.relkind IN ('r', 'p')
     JOIN pg_roles r ON r.rolname = current_user
     LEFT JOIN pg_policies p ON p.schemaname = 'public'
                            AND p.tablename = names.table_name
     GROUP BY names.table_name, c.relrowsecurity, c.relforcerowsecurity,
              c.relowner, r.oid`,
    [tenantTables]
  );
  const unsafe = isolation.rows.filter(row =>
    row.rls_enabled !== true ||
    row.rls_forced !== true ||
    row.runtime_is_owner !== false ||
    Number(row.policy_count) < 1
  );
  if (unsafe.length) throw new Error('Customer-data row-level isolation is not enabled');
  return true;
}

async function closePool() {
  if (pool) {
    const current = pool;
    pool = undefined;
    await current.end();
  }
}

module.exports = { isDatabaseConfigured, getPool, query, withTransaction, healthCheck, closePool };
