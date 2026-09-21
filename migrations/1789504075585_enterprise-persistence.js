/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  /*
   * ================================================================
   * USERS
   * ================================================================
   */
  pgm.createTable('users', {
    id: {
      type: 'text',
      primaryKey: true
    },

    name: {
      type: 'text',
      notNull: true
    },

    email: {
      type: 'text',
      notNull: true
    },

    password_hash: {
      type: 'text',
      notNull: true
    },

    role: {
      type: 'text',
      notNull: true,
      default: 'user'
    },

    status: {
      type: 'text',
      notNull: true,
      default: 'active'
    },

    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()')
    },

    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()')
    }
  });

  pgm.addConstraint('users', 'users_role_check', {
    check: "role IN ('user', 'admin')"
  });

  pgm.addConstraint('users', 'users_status_check', {
    check: "status IN ('active', 'pending', 'inactive')"
  });

  /*
   * Case-insensitive email uniqueness.
   */
  pgm.createIndex('users', 'LOWER(email)', {
    name: 'users_email_lower_unique',
    unique: true
  });

  /*
   * ================================================================
   * USER AUTH SESSIONS
   * ================================================================
   *
   * Browser receives the raw bearer token.
   * Database stores only SHA-256(token).
   */
  pgm.createTable('user_sessions', {
    token_hash: {
      type: 'text',
      primaryKey: true
    },

    user_id: {
      type: 'text',
      notNull: true
    },

    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()')
    },

    expires_at: {
      type: 'timestamptz',
      notNull: true
    }
  });

  pgm.addConstraint('user_sessions', 'user_sessions_user_fk', {
    foreignKeys: {
      columns: 'user_id',
      references: 'users(id)',
      onDelete: 'CASCADE'
    }
  });

  pgm.createIndex('user_sessions', 'user_id');
  pgm.createIndex('user_sessions', 'expires_at');

  /*
   * ================================================================
   * INQUIRIES
   * ================================================================
   *
   * Anonymous visitors are NOT fake users.
   */
  pgm.alterColumn('inquiries', 'user_id', {
    type: 'text',
    notNull: false,
    default: null
  });

  pgm.addColumn('inquiries', {
    anonymous_id: {
      type: 'text'
    }
  });

  pgm.sql(`
    UPDATE inquiries
       SET user_id = NULL
     WHERE user_id = 'anon'
  `);

  pgm.addConstraint('inquiries', 'inquiries_user_fk', {
    foreignKeys: {
      columns: 'user_id',
      references: 'users(id)',
      onDelete: 'SET NULL'
    }
  });

  pgm.createIndex('inquiries', 'user_id');
  pgm.createIndex('inquiries', 'anonymous_id');

  /*
   * ================================================================
   * PUSH SUBSCRIPTIONS
   * ================================================================
   */
  pgm.alterColumn('push_subscriptions', 'user_id', {
    type: 'text',
    notNull: false,
    default: null
  });

  pgm.addColumn('push_subscriptions', {
    anonymous_id: {
      type: 'text'
    }
  });

  pgm.sql(`
    UPDATE push_subscriptions
       SET user_id = NULL
     WHERE user_id = 'anon'
  `);

  pgm.addConstraint(
    'push_subscriptions',
    'push_subscriptions_user_fk',
    {
      foreignKeys: {
        columns: 'user_id',
        references: 'users(id)',
        onDelete: 'SET NULL'
      }
    }
  );

  pgm.createIndex('push_subscriptions', 'user_id');
  pgm.createIndex('push_subscriptions', 'anonymous_id');

  /*
   * ================================================================
   * ANALYTICS
   * ================================================================
   */
  pgm.addColumn('analytics_events', {
    user_id: {
      type: 'text'
    },

    anonymous_id: {
      type: 'text'
    }
  });

  pgm.addConstraint(
    'analytics_events',
    'analytics_events_user_fk',
    {
      foreignKeys: {
        columns: 'user_id',
        references: 'users(id)',
        onDelete: 'SET NULL'
      }
    }
  );

  pgm.createIndex('analytics_events', 'user_id');
  pgm.createIndex('analytics_events', 'anonymous_id');
  pgm.createIndex('analytics_events', 'name_or_path');

  /*
   * ================================================================
   * ADMIN SESSIONS
   * ================================================================
   *
   * Existing application stores raw tokens in memory.
   * Production persistence will store only token hashes.
   */
  pgm.renameColumn(
    'admin_sessions',
    'token',
    'token_hash'
  );

  /*
   * The baseline migration already created
   * admin_sessions_expires_at_index.
   * Do not create the same index twice.
   */

  /*
   * ================================================================
   * RATE LIMITING
   * ================================================================
   */
  pgm.addConstraint(
    'rate_limit_buckets',
    'rate_limit_buckets_count_check',
    {
      check: 'count >= 0'
    }
  );

  pgm.createIndex(
    'rate_limit_buckets',
    ['kind', 'window_start']
  );
};

exports.down = (pgm) => {
  pgm.dropIndex(
    'rate_limit_buckets',
    ['kind', 'window_start']
  );

  pgm.dropConstraint(
    'rate_limit_buckets',
    'rate_limit_buckets_count_check'
  );

  pgm.renameColumn(
    'admin_sessions',
    'token_hash',
    'token'
  );

  pgm.dropIndex(
    'analytics_events',
    'name_or_path'
  );

  pgm.dropIndex(
    'analytics_events',
    'anonymous_id'
  );

  pgm.dropIndex(
    'analytics_events',
    'user_id'
  );

  pgm.dropConstraint(
    'analytics_events',
    'analytics_events_user_fk'
  );

  pgm.dropColumn(
    'analytics_events',
    ['user_id', 'anonymous_id']
  );

  pgm.dropIndex(
    'push_subscriptions',
    'anonymous_id'
  );

  pgm.dropIndex(
    'push_subscriptions',
    'user_id'
  );

  pgm.dropConstraint(
    'push_subscriptions',
    'push_subscriptions_user_fk'
  );

  pgm.dropColumn(
    'push_subscriptions',
    'anonymous_id'
  );

  pgm.alterColumn('push_subscriptions', 'user_id', {
    type: 'text',
    notNull: true,
    default: 'anon'
  });

  pgm.dropIndex(
    'inquiries',
    'anonymous_id'
  );

  pgm.dropIndex(
    'inquiries',
    'user_id'
  );

  pgm.dropConstraint(
    'inquiries',
    'inquiries_user_fk'
  );

  pgm.dropColumn(
    'inquiries',
    'anonymous_id'
  );

  pgm.alterColumn('inquiries', 'user_id', {
    type: 'text',
    notNull: true,
    default: 'anon'
  });

  pgm.dropIndex(
    'user_sessions',
    'expires_at'
  );

  pgm.dropIndex(
    'user_sessions',
    'user_id'
  );

  pgm.dropConstraint(
    'user_sessions',
    'user_sessions_user_fk'
  );

  pgm.dropTable('user_sessions');

  pgm.dropIndex(
    'users',
    'users_email_lower_unique'
  );

  pgm.dropConstraint(
    'users',
    'users_status_check'
  );

  pgm.dropConstraint(
    'users',
    'users_role_check'
  );

  pgm.dropTable('users');
};
