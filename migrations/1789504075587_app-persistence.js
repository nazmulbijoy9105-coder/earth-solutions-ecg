exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE app_inquiries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      legacy_id text UNIQUE,
      auth_user_id uuid REFERENCES neon_auth."user"(id) ON DELETE SET NULL,
      anonymous_id text,
      stage text NOT NULL DEFAULT 'unknown',
      lang text NOT NULL DEFAULT 'en' CHECK (lang IN ('en', 'bn')),
      source text NOT NULL DEFAULT 'ai' CHECK (source IN ('faq', 'ai', 'fallback')),
      preview text NOT NULL DEFAULT '',
      ip_fingerprint char(64),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX app_inquiries_created_idx ON app_inquiries (created_at DESC);
    CREATE INDEX app_inquiries_stage_lang_idx ON app_inquiries (stage, lang, created_at DESC);

    CREATE TABLE app_analytics_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      source_fingerprint char(64) NOT NULL UNIQUE,
      auth_user_id uuid REFERENCES neon_auth."user"(id) ON DELETE SET NULL,
      anonymous_id text,
      event_type text NOT NULL CHECK (event_type IN ('pageview', 'event')),
      path text,
      referrer_origin text,
      event_name text,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX app_analytics_events_created_idx ON app_analytics_events (created_at DESC);
    CREATE INDEX app_analytics_events_type_path_idx ON app_analytics_events (event_type, path, created_at DESC);

    CREATE TABLE app_push_subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      auth_user_id uuid REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
      anonymous_id text,
      endpoint text NOT NULL UNIQUE,
      subscription jsonb NOT NULL,
      stage smallint CHECK (stage BETWEEN 1 AND 7),
      lang text NOT NULL DEFAULT 'en' CHECK (lang IN ('en', 'bn')),
      created_at timestamptz NOT NULL DEFAULT now(),
      last_seen_at timestamptz NOT NULL DEFAULT now(),
      CHECK (auth_user_id IS NOT NULL OR anonymous_id IS NOT NULL)
    );
    CREATE INDEX app_push_subscriptions_user_idx ON app_push_subscriptions (auth_user_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS app_push_subscriptions;
    DROP TABLE IF EXISTS app_analytics_events;
    DROP TABLE IF EXISTS app_inquiries;
  `);
};
