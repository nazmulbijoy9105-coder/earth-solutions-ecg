'use strict';

const { AsyncLocalStorage } = require('node:async_hooks');
const { Pool, neonConfig } = require('@neondatabase/serverless');

const requestContext = new AsyncLocalStorage();

let pool;
let adminPool;

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

function getAdminPool() {
  if (!process.env.ADMIN_DATABASE_URL || !process.env.ADMIN_DATABASE_URL.startsWith('postgres')) {
    throw new Error('ADMIN_DATABASE_URL is required for privileged application operations');
  }
  if (!adminPool) {
    if (typeof globalThis.WebSocket === 'function') neonConfig.webSocketConstructor = globalThis.WebSocket;
    adminPool = new Pool({
      connectionString: process.env.ADMIN_DATABASE_URL,
      max: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    adminPool.on('error', () => process.stderr.write('[database] privileged idle connection error\\n'));
  }
  return adminPool;
}
function getContextPool() {
  return requestContext.getStore()?.role === 'admin' ? getAdminPool() : getPool();
}

async function query(text, params = []) {
  if (!requestContext.getStore()) throw new Error('Database query requires an explicit trusted identity context');
  return withTransaction(client => client.query(text, params));
}

async function querySystem(text, params = []) {
  return getPool().query(text, params);
}

async function withTenantContext(context, work) {
  if (!context || typeof context !== 'object' || typeof work !== 'function') throw new Error('Trusted database identity context is required');
  const authUserId = context.authUserId || '';
  const anonymousId = context.anonymousId || '';
  const role = context.role === 'admin' ? 'admin' : 'user';
  if (Boolean(authUserId) === Boolean(anonymousId) && role !== 'admin') throw new Error('Exactly one customer identity is required');
  if (authUserId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(authUserId)) throw new Error('Invalid authenticated database identity');
  if (anonymousId && !/^guest_[A-Za-z0-9_-]{32,80}$/.test(anonymousId)) throw new Error('Invalid signed guest database identity');
  const rateLimitKeys = Array.isArray(context.rateLimitKeys) ? context.rateLimitKeys.slice(0, 2) : [];
  if (rateLimitKeys.some(key => typeof key !== 'string' || !/^[a-f0-9]{64}$/i.test(key))) throw new Error('Invalid rate-limit context');
  return requestContext.run({ authUserId, anonymousId, role, verifiedEmail: context.verifiedEmail || '', rateLimitKeys }, work);
}

async function applyContext(client) {
  const context = requestContext.getStore();
  if (!context) throw new Error('Database transaction requires trusted identity context');
  await client.query("SELECT set_config('app.auth_user_id', $1, true), set_config('app.anonymous_id', $2, true), set_config('app.verified_email', $3, true), set_config('app.rate_limit_key_1', $4, true), set_config('app.rate_limit_key_2', $5, true)", [context.authUserId, context.anonymousId, context.verifiedEmail, context.rateLimitKeys[0] || '', context.rateLimitKeys[1] || '']);
}

async function withTransaction(work) {
  const client = await getContextPool().connect();
  try {
    await client.query('BEGIN');
    await applyContext(client);
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

async function healthCheck(pools = {}) {
  const runtimePool = pools.runtimePool || getPool();
  const adminDbPool = pools.adminPool || getAdminPool();
  const runtimeQuery = (text, params = []) => runtimePool.query(text, params);
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
  const result = await runtimeQuery(
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
  const ledger = await querySystem(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'pgmigrations'
     ) AS present`
  );
  if (!ledger.rows[0]?.present) throw new Error('Migration ledger is missing');

  // The web process must not connect as a superuser or a BYPASSRLS role.
  const role = await querySystem(
    `SELECT current_database() AS database_name, current_user AS role_name,
            r.rolsuper, r.rolbypassrls, r.rolinherit, r.rolcreatedb, r.rolcreaterole,
            pg_has_role(current_user, 'earth_app_runtime', 'MEMBER') AS runtime_member,
            pg_has_role(current_user, 'earth_app_admin', 'MEMBER') AS admin_member
     FROM pg_roles r WHERE r.rolname = current_user`
  );
  if (!role.rows[0] || role.rows[0].rolsuper || role.rows[0].rolbypassrls || !role.rows[0].rolinherit || !role.rows[0].runtime_member || role.rows[0].rolcreatedb || role.rows[0].rolcreaterole || role.rows[0].admin_member) {
    throw new Error('Database runtime role is not least-privileged');
  }

  // Admin operations use a separate credential and a separate non-bypass role.
  // Never allow the customer runtime login to inherit this role.
  const adminRole = await adminDbPool.query(
    `SELECT r.rolsuper, r.rolbypassrls, r.rolinherit, r.rolcreatedb, r.rolcreaterole,
            pg_has_role(current_user, 'earth_app_admin', 'MEMBER') AS admin_member,
            pg_has_role(current_user, 'earth_app_runtime', 'MEMBER') AS runtime_member
     FROM pg_roles r WHERE r.rolname = current_user`
  );
  if (!adminRole.rows[0] || adminRole.rows[0].rolsuper || adminRole.rows[0].rolbypassrls ||
      !adminRole.rows[0].rolinherit || adminRole.rows[0].rolcreatedb || adminRole.rows[0].rolcreaterole || !adminRole.rows[0].admin_member || adminRole.rows[0].runtime_member) {
    throw new Error('Database admin role is not separately least-privileged');
  }
  const adminOwnership = await getAdminPool().query(
    `SELECT count(*)::int AS owned
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     JOIN pg_roles r ON r.rolname = current_user
     WHERE n.nspname = 'public'
       AND c.relname = ANY($1::text[])
       AND c.relowner = r.oid`,
    [requiredTables]
  );
  if (Number(adminOwnership.rows[0]?.owned || 0) > 0) throw new Error('Database admin role must not own application tables');

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
  const isolation = await querySystem(
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
  const pools = [pool, adminPool].filter(Boolean);
  pool = undefined;
  adminPool = undefined;
  await Promise.all(pools.map(current => current.end()));
}

module.exports = { isDatabaseConfigured, getPool, getAdminPool, query, querySystem, withTransaction, withTenantContext, healthCheck, closePool };
