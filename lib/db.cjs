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
  const result = await query('SELECT 1 AS ok');
  return result.rows[0]?.ok === 1;
}

async function closePool() {
  if (pool) {
    const current = pool;
    pool = undefined;
    await current.end();
  }
}

module.exports = { isDatabaseConfigured, getPool, query, withTransaction, healthCheck, closePool };
