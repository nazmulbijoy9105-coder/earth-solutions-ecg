/* eslint-disable camelcase */

// Application-owned data is deliberately separated from neon_auth.
// Neon Auth owns identity and sessions; app_user_profiles owns app roles.
// Legacy password hashes are intentionally NOT imported into this schema.
exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE app_user_profiles (
      auth_user_id uuid PRIMARY KEY REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
      display_name text,
      role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
      account_status text NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended')),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE legacy_account_imports (
      legacy_id text PRIMARY KEY,
      display_name text NOT NULL,
      email text NOT NULL,
      legacy_role_label text NOT NULL DEFAULT 'user',
      legacy_status_label text NOT NULL DEFAULT 'pending',
      legacy_created_at timestamptz,
      record_fingerprint char(64) NOT NULL,
      migration_status text NOT NULL DEFAULT 'review_required'
        CHECK (migration_status IN ('review_required', 'claim_pending', 'linked', 'rejected')),
      linked_auth_user_id uuid REFERENCES neon_auth."user"(id) ON DELETE SET NULL,
      imported_at timestamptz NOT NULL DEFAULT now(),
      reviewed_at timestamptz,
      reviewed_by_auth_user_id uuid REFERENCES neon_auth."user"(id) ON DELETE SET NULL
    );
    CREATE UNIQUE INDEX legacy_account_imports_email_lower_uq
      ON legacy_account_imports (lower(email));

    CREATE TABLE chat_conversations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      auth_user_id uuid REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
      anonymous_id text,
      title text,
      stage smallint CHECK (stage BETWEEN 1 AND 7),
      lang text NOT NULL DEFAULT 'en' CHECK (lang IN ('en', 'bn')),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      archived_at timestamptz,
      CHECK (
        (auth_user_id IS NOT NULL AND anonymous_id IS NULL) OR
        (auth_user_id IS NULL AND anonymous_id IS NOT NULL)
      )
    );
    CREATE INDEX chat_conversations_user_updated_idx
      ON chat_conversations (auth_user_id, updated_at DESC);
    CREATE INDEX chat_conversations_anonymous_updated_idx
      ON chat_conversations (anonymous_id, updated_at DESC);

    CREATE TABLE chat_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
      role text NOT NULL CHECK (role IN ('user', 'assistant')),
      content text NOT NULL,
      provider text,
      model text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX chat_messages_conversation_created_idx
      ON chat_messages (conversation_id, created_at);

    CREATE TABLE payment_orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_reference text NOT NULL UNIQUE,
      auth_user_id uuid REFERENCES neon_auth."user"(id) ON DELETE SET NULL,
      anonymous_id text,
      provider text NOT NULL CHECK (provider IN ('bkash', 'nagad')),
      product_code text NOT NULL,
      amount numeric(12,2) NOT NULL CHECK (amount > 0),
      currency char(3) NOT NULL DEFAULT 'BDT' CHECK (currency = 'BDT'),
      status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'initiated', 'paid', 'failed', 'expired', 'partially_refunded', 'refunded')),
      idempotency_key text NOT NULL UNIQUE,
      provider_transaction_id text,
      provider_payment_reference text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      paid_at timestamptz,
      CHECK (auth_user_id IS NOT NULL OR anonymous_id IS NOT NULL)
    );
    CREATE UNIQUE INDEX payment_orders_provider_txn_uq
      ON payment_orders (provider, provider_transaction_id)
      WHERE provider_transaction_id IS NOT NULL;
    CREATE INDEX payment_orders_status_created_idx
      ON payment_orders (status, created_at DESC);

    CREATE TABLE payment_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      payment_order_id uuid NOT NULL REFERENCES payment_orders(id) ON DELETE RESTRICT,
      provider text NOT NULL CHECK (provider IN ('bkash', 'nagad')),
      provider_event_id text NOT NULL,
      event_type text NOT NULL,
      signature_verified boolean NOT NULL DEFAULT false,
      payload_sha256 char(64) NOT NULL,
      redacted_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      processing_status text NOT NULL DEFAULT 'pending'
        CHECK (processing_status IN ('pending', 'processed', 'rejected', 'failed')),
      received_at timestamptz NOT NULL DEFAULT now(),
      processed_at timestamptz,
      UNIQUE (provider, provider_event_id)
    );
    CREATE INDEX payment_events_order_received_idx
      ON payment_events (payment_order_id, received_at);

    CREATE TABLE immigration_sources (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      jurisdiction text NOT NULL,
      topic text NOT NULL,
      authority_name text NOT NULL,
      canonical_url text NOT NULL,
      title text NOT NULL,
      language text NOT NULL DEFAULT 'en',
      publication_date date,
      effective_from date,
      effective_to date,
      status text NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'verified', 'outdated', 'conflicting', 'retired')),
      latest_version integer NOT NULL DEFAULT 1 CHECK (latest_version > 0),
      review_due_at timestamptz,
      created_by_auth_user_id uuid REFERENCES neon_auth."user"(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (jurisdiction, canonical_url)
    );
    CREATE INDEX immigration_sources_jurisdiction_topic_idx
      ON immigration_sources (jurisdiction, topic, status);

    CREATE TABLE immigration_source_versions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      source_id uuid NOT NULL REFERENCES immigration_sources(id) ON DELETE CASCADE,
      version_number integer NOT NULL CHECK (version_number > 0),
      canonical_url text NOT NULL,
      document_title text NOT NULL,
      content_sha256 char(64) NOT NULL,
      retrieved_at timestamptz NOT NULL,
      publication_date date,
      effective_from date,
      effective_to date,
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (source_id, version_number),
      UNIQUE (source_id, content_sha256)
    );

    CREATE TABLE immigration_source_reviews (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      source_version_id uuid NOT NULL REFERENCES immigration_source_versions(id) ON DELETE RESTRICT,
      reviewer_auth_user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
      decision text NOT NULL CHECK (decision IN ('verified', 'rejected', 'outdated', 'conflicting')),
      review_notes text,
      reviewed_at timestamptz NOT NULL DEFAULT now(),
      next_review_at timestamptz
    );
    CREATE INDEX immigration_source_reviews_version_idx
      ON immigration_source_reviews (source_version_id, reviewed_at DESC);

    CREATE TABLE audit_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_auth_user_id uuid REFERENCES neon_auth."user"(id) ON DELETE SET NULL,
      action text NOT NULL,
      entity_type text NOT NULL,
      entity_id text,
      request_id text,
      ip_fingerprint char(64),
      details jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX audit_events_entity_created_idx
      ON audit_events (entity_type, entity_id, created_at DESC);
    CREATE INDEX audit_events_actor_created_idx
      ON audit_events (actor_auth_user_id, created_at DESC);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS audit_events;
    DROP TABLE IF EXISTS immigration_source_reviews;
    DROP TABLE IF EXISTS immigration_source_versions;
    DROP TABLE IF EXISTS immigration_sources;
    DROP TABLE IF EXISTS payment_events;
    DROP TABLE IF EXISTS payment_orders;
    DROP TABLE IF EXISTS chat_messages;
    DROP TABLE IF EXISTS chat_conversations;
    DROP TABLE IF EXISTS legacy_account_imports;
    DROP TABLE IF EXISTS app_user_profiles;
  `);
};
