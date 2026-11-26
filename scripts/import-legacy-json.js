'use strict';

// Safe, repeatable legacy JSON import. Default mode is dry-run.
// Password hashes are deliberately excluded; legacy roles are labels only.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { withTransaction, closePool, isDatabaseConfigured } = require('../lib/db.cjs');

const root = path.resolve(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, 'data', name), 'utf8'));
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const includePush = args.has('--include-push');

function safeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function referrerOrigin(value) {
  try { return new URL(value).origin; } catch { return null; }
}

function safePath(value) {
  try {
    const parsed = new URL(value, 'https://local.invalid');
    return parsed.pathname.slice(0, 500);
  } catch {
    return typeof value === 'string' ? value.split('?')[0].slice(0, 500) : null;
  }
}

function loadData() {
  const users = read('users.json').users || [];
  const inquiries = read('inquiries.json').inquiries || [];
  const analytics = read('analytics.json');
  const events = analytics.events || [];
  const subscriptions = read('push_subscriptions.json').subscriptions || [];

  const seenEmails = new Set();
  for (const user of users) {
    const email = String(user.email || '').trim().toLowerCase();
    if (!user.id || !user.name || !email || !email.includes('@')) {
      throw new Error('A legacy user record is missing a valid id, name, or email');
    }
    if (seenEmails.has(email)) throw new Error('Duplicate legacy email prevents safe import: ' + email);
    seenEmails.add(email);
  }

  for (const inquiry of inquiries) {
    if (!inquiry.id) throw new Error('An inquiry is missing its legacy id');
  }
  for (const event of events) {
    if (!['pageview', 'event'].includes(event.type)) throw new Error('Unsupported analytics event type');
  }
  if (includePush) {
    for (const item of subscriptions) {
      if (!item.subscription?.endpoint) throw new Error('A push subscription is missing its endpoint');
    }
  }

  return { users, inquiries, events, subscriptions: includePush ? subscriptions : [] };
}

async function main() {
  const data = loadData();
  const counts = {
    legacyAccounts: data.users.length,
    inquiries: data.inquiries.length,
    analyticsEvents: data.events.length,
    pushSubscriptions: data.subscriptions.length,
    passwordHashesImported: 0,
    legacyAdminPrivilegesGranted: 0,
  };

  if (!apply) {
    process.stdout.write(JSON.stringify({ mode: 'dry-run', counts }, null, 2) + '\n');
    return;
  }

  if (process.env.CONFIRM_LEGACY_IMPORT !== '1') {
    throw new Error('Set CONFIRM_LEGACY_IMPORT=1 only after reviewing the dry-run report');
  }
  if (!isDatabaseConfigured()) throw new Error('DATABASE_URL is required for --apply');

  await withTransaction(async client => {
    for (const user of data.users) {
      const safeRecord = {
        id: String(user.id),
        name: String(user.name),
        email: String(user.email).trim().toLowerCase(),
        role: String(user.role || 'user'),
        status: String(user.status || 'pending'),
        createdAt: safeDate(user.createdAt),
      };
      await client.query(
        `INSERT INTO legacy_account_imports
          (legacy_id, display_name, email, legacy_role_label, legacy_status_label,
           legacy_created_at, record_fingerprint, migration_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'review_required')
         ON CONFLICT (legacy_id) DO NOTHING`,
        [
          safeRecord.id,
          safeRecord.name,
          safeRecord.email,
          safeRecord.role,
          safeRecord.status,
          safeRecord.createdAt,
          sha256(JSON.stringify(safeRecord)),
        ]
      );
    }

    for (const inquiry of data.inquiries) {
      const ipFingerprint = inquiry.ip ? sha256(String(inquiry.ip).split(',')[0].trim()) : null;
      await client.query(
        `INSERT INTO app_inquiries
          (legacy_id, anonymous_id, stage, lang, source, preview, ip_fingerprint, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, now()))
         ON CONFLICT (legacy_id) DO NOTHING`,
        [
          String(inquiry.id),
          typeof inquiry.userId === 'string' && inquiry.userId.startsWith('anon_') ? inquiry.userId : null,
          String(inquiry.stage || 'unknown'),
          inquiry.lang === 'bn' ? 'bn' : 'en',
          ['faq', 'ai', 'fallback'].includes(inquiry.source) ? inquiry.source : 'ai',
          String(inquiry.preview || '').slice(0, 150),
          ipFingerprint,
          safeDate(inquiry.time),
        ]
      );
    }

    for (let i = 0; i < data.events.length; i++) {
      const event = data.events[i];
      const safeEvent = {
        type: event.type,
        path: safePath(event.path),
        referrerOrigin: referrerOrigin(event.referrer),
        name: typeof event.name === 'string' ? event.name.slice(0, 100) : null,
        meta: event.meta && typeof event.meta === 'object' ? event.meta : {},
        time: safeDate(event.time),
      };
      await client.query(
        `INSERT INTO app_analytics_events
          (source_fingerprint, event_type, path, referrer_origin, event_name, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, COALESCE($7::timestamptz, now()))
         ON CONFLICT (source_fingerprint) DO NOTHING`,
        [
          sha256(String(i) + ':' + JSON.stringify(safeEvent)),
          safeEvent.type,
          safeEvent.path,
          safeEvent.referrerOrigin,
          safeEvent.name,
          JSON.stringify(safeEvent.meta),
          safeEvent.time,
        ]
      );
    }

    for (const item of data.subscriptions) {
      const subscription = item.subscription;
      await client.query(
        `INSERT INTO app_push_subscriptions
          (anonymous_id, endpoint, subscription, stage, lang)
         VALUES ($1, $2, $3::jsonb, $4, $5)
         ON CONFLICT (endpoint) DO NOTHING`,
        [
          typeof item.userId === 'string' && item.userId.startsWith('anon_') ? item.userId : null,
          subscription.endpoint,
          JSON.stringify(subscription),
          Number.isInteger(Number(item.stage)) && Number(item.stage) >= 1 && Number(item.stage) <= 7 ? Number(item.stage) : null,
          item.lang === 'bn' ? 'bn' : 'en',
        ]
      );
    }
  });

  process.stdout.write(JSON.stringify({ mode: 'applied', counts }, null, 2) + '\n');
}

main().catch(error => {
  process.stderr.write('[legacy-import] ' + error.message + '\n');
  process.exitCode = 1;
}).finally(async () => {
  try { await closePool(); } catch {}
});
