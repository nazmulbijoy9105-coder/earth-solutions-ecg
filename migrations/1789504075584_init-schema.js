/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('inquiries', {
    id: 'id',
    user_id: { type: 'text', notNull: true, default: 'anon' },
    stage: { type: 'text' },
    lang: { type: 'text', notNull: true, default: 'en' },
    source: { type: 'text', notNull: true, default: 'ai' },
    preview: { type: 'text' },
    ip: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') }
  });
  pgm.createIndex('inquiries', 'stage');
  pgm.createIndex('inquiries', 'created_at');

  pgm.createTable('analytics_events', {
    id: 'id',
    type: { type: 'text', notNull: true },
    name_or_path: { type: 'text' },
    referrer: { type: 'text' },
    meta: { type: 'jsonb' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') }
  });
  pgm.createIndex('analytics_events', 'type');
  pgm.createIndex('analytics_events', 'created_at');

  pgm.createTable('push_subscriptions', {
    id: 'id',
    endpoint: { type: 'text', notNull: true, unique: true },
    subscription: { type: 'jsonb', notNull: true },
    user_id: { type: 'text', notNull: true, default: 'anon' },
    stage: { type: 'text' },
    lang: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') }
  });

  pgm.createTable('admin_sessions', {
    token: { type: 'text', primaryKey: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    expires_at: { type: 'timestamptz', notNull: true }
  });
  pgm.createIndex('admin_sessions', 'expires_at');

  pgm.createTable('rate_limit_buckets', {
    id: 'id',
    bucket_key: { type: 'text', notNull: true },
    kind: { type: 'text', notNull: true },
    window_start: { type: 'timestamptz', notNull: true },
    count: { type: 'integer', notNull: true, default: 1 }
  });
  pgm.addConstraint('rate_limit_buckets', 'rate_limit_buckets_key_kind_unique', {
    unique: ['bucket_key', 'kind']
  });
};

exports.down = (pgm) => {
  pgm.dropTable('rate_limit_buckets');
  pgm.dropTable('admin_sessions');
  pgm.dropTable('push_subscriptions');
  pgm.dropTable('analytics_events');
  pgm.dropTable('inquiries');
};
