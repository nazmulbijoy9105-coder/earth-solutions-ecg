'use strict';

const crypto = require('node:crypto');
const { query, withTransaction } = require('./db.cjs');

const sha256 = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const safeLang = value => value === 'bn' ? 'bn' : 'en';
const safeStage = value => String(value || 'unknown').slice(0, 40);
const anonymousOwner = value => typeof value === 'string' && /^anon_[A-Za-z0-9_-]{16,100}$/.test(value) ? value : null;

async function createInquiry({ userId, authUserId, stage, lang, firstMessage, ip, source }) {
  const ipAddress = String(ip || '').split(',')[0].trim();
  await query(
    `INSERT INTO app_inquiries
      (auth_user_id, anonymous_id, stage, lang, source, preview, ip_fingerprint)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      authUserId || null,
      authUserId ? null : anonymousOwner(userId),
      safeStage(stage),
      safeLang(lang),
      ['faq', 'ai', 'fallback'].includes(source) ? source : 'ai',
      String(firstMessage || '').slice(0, 150),
      ipAddress ? sha256(ipAddress) : null,
    ]
  );
}

async function logPageview(pathname, referrer, { userId, authUserId } = {}) {
  const path = String(pathname || '/').split('?')[0].slice(0, 500);
  let referrerOrigin = null;
  try { referrerOrigin = new URL(referrer).origin; } catch {}
  const fingerprint = sha256(crypto.randomUUID() + ':' + path + ':' + Date.now());
  await query(
    `INSERT INTO app_analytics_events
      (source_fingerprint, auth_user_id, anonymous_id, event_type, path, referrer_origin)
     VALUES ($1, $2, $3, 'pageview', $4, $5)`,
    [fingerprint, authUserId || null, authUserId ? null : anonymousOwner(userId), path, referrerOrigin]
  );
}

async function logEvent(name, meta = {}, { userId, authUserId } = {}) {
  const eventName = String(name || 'unknown').slice(0, 100);
  const safeMeta = meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {};
  const fingerprint = sha256(crypto.randomUUID() + ':' + eventName + ':' + Date.now());
  await query(
    `INSERT INTO app_analytics_events
      (source_fingerprint, auth_user_id, anonymous_id, event_type, event_name, metadata)
     VALUES ($1, $2, $3, 'event', $4, $5::jsonb)`,
    [fingerprint, authUserId || null, authUserId ? null : anonymousOwner(userId), eventName, JSON.stringify(safeMeta)]
  );
}

async function savePushSubscription({ subscription, userId, authUserId, stage, lang }) {
  const endpoint = subscription && subscription.endpoint;
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) {
    throw new Error('Invalid push subscription endpoint');
  }
  const anonymousId = authUserId ? null : anonymousOwner(userId);
  if (!authUserId && !anonymousId) throw new Error('A valid account or anonymous owner is required');

  await query(
    `INSERT INTO app_push_subscriptions
      (auth_user_id, anonymous_id, endpoint, subscription, stage, lang)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6)
     ON CONFLICT (endpoint) DO UPDATE SET
       auth_user_id = EXCLUDED.auth_user_id,
       anonymous_id = EXCLUDED.anonymous_id,
       subscription = EXCLUDED.subscription,
       stage = EXCLUDED.stage,
       lang = EXCLUDED.lang,
       last_seen_at = now()`,
    [
      authUserId || null,
      anonymousId,
      endpoint,
      JSON.stringify(subscription),
      Number.isInteger(Number(stage)) && Number(stage) >= 1 && Number(stage) <= 7 ? Number(stage) : null,
      safeLang(lang),
    ]
  );
}

async function removePushSubscription({ endpoint, userId, authUserId }) {
  if (typeof endpoint !== 'string' || endpoint.length > 4096) return 0;
  const owner = authUserId || anonymousOwner(userId);
  if (!owner) return 0;
  const result = authUserId
    ? await query('DELETE FROM app_push_subscriptions WHERE endpoint = $1 AND auth_user_id = $2', [endpoint, authUserId])
    : await query('DELETE FROM app_push_subscriptions WHERE endpoint = $1 AND anonymous_id = $2', [endpoint, owner]);
  return result.rowCount || 0;
}

async function listPushSubscriptions() {
  const result = await query('SELECT id, subscription, endpoint FROM app_push_subscriptions ORDER BY created_at');
  return result.rows;
}

async function removePushEndpoints(endpoints) {
  if (!Array.isArray(endpoints) || endpoints.length === 0) return 0;
  const result = await query('DELETE FROM app_push_subscriptions WHERE endpoint = ANY($1::text[])', [endpoints]);
  return result.rowCount || 0;
}

async function getAdminStats() {
  const [summary, byStage, daily, analytics, push] = await Promise.all([
    query(`SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE created_at::date = current_date)::int AS today,
      count(*) FILTER (WHERE lang = 'en')::int AS total_en,
      count(*) FILTER (WHERE lang = 'bn')::int AS total_bn
      FROM app_inquiries`),
    query(`SELECT stage AS id, count(*)::int AS count
      FROM app_inquiries GROUP BY stage ORDER BY count DESC`),
    query(`SELECT to_char(days.day::date, 'MM-DD') AS date, count(i.id)::int AS count
      FROM generate_series(current_date - 13, current_date, interval '1 day') AS days(day)
      LEFT JOIN app_inquiries i ON i.created_at::date = days.day::date
      GROUP BY days.day ORDER BY days.day`),
    query(`SELECT count(*)::int AS total_pageviews
      FROM app_analytics_events WHERE event_type = 'pageview'`),
    query('SELECT count(*)::int AS total FROM app_push_subscriptions'),
  ]);
  const sourceRows = await query(`SELECT source, count(*)::int AS count
    FROM app_inquiries GROUP BY source`);
  const sources = { faq: 0, ai: 0, fallback: 0 };
  for (const row of sourceRows.rows) sources[row.source] = row.count;

  return {
    total: summary.rows[0].total,
    today: summary.rows[0].today,
    totalEn: summary.rows[0].total_en,
    totalBn: summary.rows[0].total_bn,
    sources,
    stageBreakdown: byStage.rows,
    daily: daily.rows,
    totalPageviews: analytics.rows[0].total_pageviews,
    pushSubscribers: push.rows[0].total,
    recentCount: summary.rows[0].total,
  };
}

async function listInquiries({ page = 1, limit = 25, stage, lang, source } = {}) {
  const safePage = Math.max(1, Math.min(100000, Number.parseInt(page, 10) || 1));
  const safeLimit = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 25));
  const clauses = [];
  const values = [];
  if (stage && stage !== 'all') { values.push(String(stage)); clauses.push('stage = $' + values.length); }
  if (lang && lang !== 'all') { values.push(safeLang(lang)); clauses.push('lang = $' + values.length); }
  if (source && source !== 'all') {
    if (!['faq', 'ai', 'fallback'].includes(source)) throw new Error('Invalid inquiry source filter');
    values.push(source); clauses.push('source = $' + values.length);
  }
  const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : '';
  const count = await query('SELECT count(*)::int AS total FROM app_inquiries ' + where, values);
  const offset = (safePage - 1) * safeLimit;
  const rows = await query(
    'SELECT id, anonymous_id AS "userId", stage, lang, source, preview, created_at AS time FROM app_inquiries ' + where +
      ' ORDER BY created_at DESC LIMIT $' + (values.length + 1) + ' OFFSET $' + (values.length + 2),
    [...values, safeLimit, offset]
  );
  return { inquiries: rows.rows, total: count.rows[0].total, page: safePage, pages: Math.ceil(count.rows[0].total / safeLimit) };
}

async function getAnalytics({ limit = 1000 } = {}) {
  const safeLimit = Math.max(1, Math.min(5000, Number.parseInt(limit, 10) || 1000));
  const [events, pageviews] = await Promise.all([
    query(`SELECT event_type AS type, path, referrer_origin AS referrer,
      event_name AS name, metadata AS meta, created_at AS time
      FROM app_analytics_events ORDER BY created_at DESC LIMIT $1`, [safeLimit]),
    query(`SELECT path, count(*)::int AS count FROM app_analytics_events
      WHERE event_type = 'pageview' GROUP BY path ORDER BY count DESC`),
  ]);
  return {
    events: events.rows,
    pageviews: Object.fromEntries(pageviews.rows.map(row => [row.path, row.count])),
  };
}

async function getRecentConversationCount() {
  const result = await query(`SELECT count(*)::int AS count FROM chat_conversations
    WHERE updated_at >= now() - interval '3 hours'`);
  return result.rows[0].count;
}

async function clearInquiries() {
  return withTransaction(async client => {
    const result = await client.query('DELETE FROM app_inquiries');
    return result.rowCount || 0;
  });
}

async function getOrCreateConversation({ conversationId, anonymousId, stage, lang }) {
  const id = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(conversationId || ''))
    ? conversationId
    : crypto.randomUUID();
  if (!anonymousOwner(anonymousId)) throw new Error('Valid anonymous owner is required');
  const stageValue = Number.isInteger(Number(stage)) && Number(stage) >= 1 && Number(stage) <= 7 ? Number(stage) : null;

  await query(
    `INSERT INTO chat_conversations (id, anonymous_id, stage, lang)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO NOTHING`,
    [id, anonymousId, stageValue, safeLang(lang)]
  );

  const result = await query(
    'SELECT id FROM chat_conversations WHERE id = $1 AND anonymous_id = $2 AND archived_at IS NULL',
    [id, anonymousId]
  );
  if (!result.rows[0]) throw new Error('Conversation does not belong to this guest');
  await query(
    'UPDATE chat_conversations SET stage = $2, lang = $3, updated_at = now() WHERE id = $1',
    [id, stageValue, safeLang(lang)]
  );
  return id;
}

async function getConversationMessages(conversationId, anonymousId, limit = 20) {
  const safeLimit = Math.max(1, Math.min(50, Number.parseInt(limit, 10) || 20));
  const result = await query(
    `SELECT m.role, m.content, m.created_at
     FROM chat_messages m
     JOIN chat_conversations c ON c.id = m.conversation_id
     WHERE c.id = $1 AND c.anonymous_id = $2 AND c.archived_at IS NULL
     ORDER BY m.created_at DESC
     LIMIT $3`,
    [conversationId, anonymousId, safeLimit]
  );
  return result.rows.reverse().map(row => ({ role: row.role, content: row.content }));
}

async function appendConversationMessage({ conversationId, anonymousId, role, content, clientMessageId, provider, model }) {
  if (!['user', 'assistant'].includes(role)) throw new Error('Invalid message role');
  const safeContent = String(content || '').slice(0, 8000);
  if (!safeContent) return;

  await withTransaction(async client => {
    const owner = await client.query(
      'SELECT id FROM chat_conversations WHERE id = $1 AND anonymous_id = $2 AND archived_at IS NULL FOR UPDATE',
      [conversationId, anonymousId]
    );
    if (!owner.rows[0]) throw new Error('Conversation does not belong to this guest');

    await client.query(
      `INSERT INTO chat_messages
        (conversation_id, client_message_id, role, content, provider, model)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (conversation_id, client_message_id)
       WHERE client_message_id IS NOT NULL
       DO NOTHING`,
      [conversationId, clientMessageId || null, role, safeContent, provider || null, model || null]
    );
    await client.query(
      'UPDATE chat_conversations SET updated_at = now() WHERE id = $1',
      [conversationId]
    );
  });
}

module.exports = {
  createInquiry,
  logPageview,
  logEvent,
  savePushSubscription,
  removePushSubscription,
  listPushSubscriptions,
  removePushEndpoints,
  getAdminStats,
  listInquiries,
  getAnalytics,
  getRecentConversationCount,
  clearInquiries,
  getOrCreateConversation,
  getConversationMessages,
  appendConversationMessage,
};
