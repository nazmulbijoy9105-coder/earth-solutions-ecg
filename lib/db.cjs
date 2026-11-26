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
