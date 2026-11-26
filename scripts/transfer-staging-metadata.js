'use strict';

// Transfers only sanitized metadata from the non-default Neon rehearsal branch.
// Dry-run is the default. No password hashes or admin privileges are transferred.
const { Pool, neonConfig } = require('@neondatabase/serverless');

if (typeof globalThis.WebSocket === 'function') neonConfig.webSocketConstructor = globalThis.WebSocket;

const apply = process.argv.includes('--apply');
const sourceUrl = process.env.LEGACY_SOURCE_DATABASE_URL;
const targetUrl = process.env.DATABASE_URL;

function createPool(connectionString) {
  if (!connectionString || !connectionString.startsWith('postgres')) {
    throw new Error('Both LEGACY_SOURCE_DATABASE_URL and DATABASE_URL are required');
  }
  return new Pool({ connectionString, max: 2, connectionTimeoutMillis: 5000 });
}

async function main() {
  if (apply && process.env.CONFIRM_LEGACY_TRANSFER !== '1') {
    throw new Error('Set CONFIRM_LEGACY_TRANSFER=1 only after reviewing the dry-run report');
  }

  const source = createPool(sourceUrl);
  const target = createPool(targetUrl);
  try {
    const [accounts, inquiries, analytics, subscriptions] = await Promise.all([
      source.query(`SELECT legacy_id, display_name, email, legacy_role_label,
        legacy_status_label, legacy_created_at, record_fingerprint, migration_status
        FROM legacy_account_imports ORDER BY legacy_id`),
      source.query(`SELECT legacy_id, auth_user_id, anonymous_id, stage, lang, source,
        preview, ip_fingerprint, created_at FROM app_inquiries ORDER BY created_at`),
      source.query(`SELECT source_fingerprint, auth_user_id, anonymous_id, event_type,
        path, referrer_origin, event_name, metadata, created_at
        FROM app_analytics_events ORDER BY created_at`),
      source.query(`SELECT auth_user_id, anonymous_id, endpoint, subscription, stage, lang,
        created_at, last_seen_at FROM app_push_subscriptions ORDER BY created_at`),
    ]);

    const counts = {
      legacyAccountMetadata: accounts.rowCount,
      inquiries: inquiries.rowCount,
      analyticsEvents: analytics.rowCount,
      pushSubscriptions: subscriptions.rowCount,
      passwordHashes: 0,
      adminPrivilegesGranted: 0,
    };

    if (!apply) {
      process.stdout.write(JSON.stringify({ mode: 'dry-run', counts }, null, 2) + '\n');
      return;
    }

    await target.query('BEGIN');
    try {
      for (const row of accounts.rows) {
        await target.query(
          `INSERT INTO legacy_account_imports
            (legacy_id, display_name, email, legacy_role_label, legacy_status_label,
             legacy_created_at, record_fingerprint, migration_status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (legacy_id) DO NOTHING`,
          [row.legacy_id,row.display_name,row.email,row.legacy_role_label,row.legacy_status_label,
           row.legacy_created_at,row.record_fingerprint,row.migration_status]
        );
      }
      for (const row of inquiries.rows) {
        await target.query(
          `INSERT INTO app_inquiries
            (legacy_id,auth_user_id,anonymous_id,stage,lang,source,preview,ip_fingerprint,created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (legacy_id) DO NOTHING`,
          [row.legacy_id,row.auth_user_id,row.anonymous_id,row.stage,row.lang,row.source,
           row.preview,row.ip_fingerprint,row.created_at]
        );
      }
      for (const row of analytics.rows) {
        await target.query(
          `INSERT INTO app_analytics_events
            (source_fingerprint,auth_user_id,anonymous_id,event_type,path,referrer_origin,event_name,metadata,created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
           ON CONFLICT (source_fingerprint) DO NOTHING`,
          [row.source_fingerprint,row.auth_user_id,row.anonymous_id,row.event_type,row.path,
           row.referrer_origin,row.event_name,JSON.stringify(row.metadata || {}),row.created_at]
        );
      }
      for (const row of subscriptions.rows) {
        await target.query(
          `INSERT INTO app_push_subscriptions
            (auth_user_id,anonymous_id,endpoint,subscription,stage,lang,created_at,last_seen_at)
           VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8)
           ON CONFLICT (endpoint) DO NOTHING`,
          [row.auth_user_id,row.anonymous_id,row.endpoint,JSON.stringify(row.subscription),
           row.stage,row.lang,row.created_at,row.last_seen_at]
        );
      }
      await target.query('COMMIT');
    } catch (error) {
      await target.query('ROLLBACK');
      throw error;
    }

    process.stdout.write(JSON.stringify({ mode: 'applied', counts }, null, 2) + '\n');
  } finally {
    await Promise.allSettled([source.end(), target.end()]);
  }
}

main().catch(error => {
  process.stderr.write('[staging-transfer] ' + error.message + '\n');
  process.exitCode = 1;
});
