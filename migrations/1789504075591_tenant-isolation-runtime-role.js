exports.shorthands = undefined;

// The migration owner runs this migration. The web runtime must connect as a
// separate login role that is a member of earth_app_runtime, never as the
// migration owner, table owner, superuser, or a BYPASSRLS principal.
exports.up = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'earth_app_runtime') THEN
        CREATE ROLE earth_app_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
      END IF;
    END $$;

    ALTER ROLE earth_app_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
    GRANT USAGE ON SCHEMA public TO earth_app_runtime;
    GRANT SELECT, INSERT, UPDATE, DELETE ON
      chat_conversations, chat_messages, payment_orders, payment_events,
      immigration_sources, immigration_source_versions, immigration_source_reviews,
      audit_events, app_inquiries, app_analytics_events, app_push_subscriptions,
      api_rate_limits, free_message_usage
    TO earth_app_runtime;

    CREATE OR REPLACE FUNCTION public.app_ctx_user_id() RETURNS text
    LANGUAGE sql STABLE PARALLEL SAFE
    AS $$ SELECT nullif(current_setting('app.auth_user_id', true), '') $$;
    CREATE OR REPLACE FUNCTION public.app_ctx_guest_id() RETURNS text
    LANGUAGE sql STABLE PARALLEL SAFE
    AS $$ SELECT nullif(current_setting('app.anonymous_id', true), '') $$;
    CREATE OR REPLACE FUNCTION public.app_ctx_is_admin() RETURNS boolean
    LANGUAGE sql STABLE PARALLEL SAFE
    AS $$ SELECT coalesce(current_setting('app.access_role', true) = 'admin', false) $$;
    CREATE OR REPLACE FUNCTION public.app_ctx_verified_email() RETURNS text
    LANGUAGE sql STABLE PARALLEL SAFE
    AS $$ SELECT nullif(lower(current_setting('app.verified_email', true)), '') $$;

    ALTER TABLE app_user_profiles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE app_user_profiles FORCE ROW LEVEL SECURITY;
    CREATE POLICY app_user_profiles_tenant ON app_user_profiles
      FOR SELECT TO earth_app_runtime
      USING (auth_user_id::text = public.app_ctx_user_id() OR public.app_ctx_is_admin());
    CREATE POLICY app_user_profiles_insert ON app_user_profiles
      FOR INSERT TO earth_app_runtime
      WITH CHECK (auth_user_id::text = public.app_ctx_user_id() OR public.app_ctx_is_admin());

    ALTER TABLE legacy_account_imports ENABLE ROW LEVEL SECURITY;
    ALTER TABLE legacy_account_imports FORCE ROW LEVEL SECURITY;
    CREATE POLICY legacy_account_imports_claim ON legacy_account_imports
      FOR SELECT TO earth_app_runtime
      USING (public.app_ctx_is_admin() OR
        (lower(email) = public.app_ctx_verified_email() AND
         (linked_auth_user_id IS NULL OR linked_auth_user_id::text = public.app_ctx_user_id())));
    CREATE POLICY legacy_account_imports_link ON legacy_account_imports
      FOR UPDATE TO earth_app_runtime
      USING (public.app_ctx_is_admin() OR
        (lower(email) = public.app_ctx_verified_email() AND
         (linked_auth_user_id IS NULL OR linked_auth_user_id::text = public.app_ctx_user_id())))
      WITH CHECK (public.app_ctx_is_admin() OR
        (linked_auth_user_id::text = public.app_ctx_user_id() AND lower(email) = public.app_ctx_verified_email()));

    ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE chat_conversations FORCE ROW LEVEL SECURITY;
    CREATE POLICY chat_conversations_owner ON chat_conversations
      FOR ALL TO earth_app_runtime
      USING (
        public.app_ctx_is_admin() OR
        (auth_user_id::text = public.app_ctx_user_id() AND anonymous_id IS NULL) OR
        (auth_user_id IS NULL AND anonymous_id = public.app_ctx_guest_id())
      )
      WITH CHECK (
        public.app_ctx_is_admin() OR
        (auth_user_id::text = public.app_ctx_user_id() AND anonymous_id IS NULL) OR
        (auth_user_id IS NULL AND anonymous_id = public.app_ctx_guest_id())
      );

    ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
    ALTER TABLE chat_messages FORCE ROW LEVEL SECURITY;
    CREATE POLICY chat_messages_owner ON chat_messages
      FOR ALL TO earth_app_runtime
      USING (public.app_ctx_is_admin() OR EXISTS (
        SELECT 1 FROM chat_conversations c
        WHERE c.id = chat_messages.conversation_id AND (
          (c.auth_user_id::text = public.app_ctx_user_id() AND c.anonymous_id IS NULL) OR
          (c.auth_user_id IS NULL AND c.anonymous_id = public.app_ctx_guest_id())
        )
      ))
      WITH CHECK (public.app_ctx_is_admin() OR EXISTS (
        SELECT 1 FROM chat_conversations c
        WHERE c.id = chat_messages.conversation_id AND (
          (c.auth_user_id::text = public.app_ctx_user_id() AND c.anonymous_id IS NULL) OR
          (c.auth_user_id IS NULL AND c.anonymous_id = public.app_ctx_guest_id())
        )
      ));

    ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;
    ALTER TABLE payment_orders FORCE ROW LEVEL SECURITY;
    CREATE POLICY payment_orders_owner ON payment_orders
      FOR ALL TO earth_app_runtime
      USING (public.app_ctx_is_admin() OR
        (auth_user_id::text = public.app_ctx_user_id() AND anonymous_id IS NULL) OR
        (auth_user_id IS NULL AND anonymous_id = public.app_ctx_guest_id()))
      WITH CHECK (public.app_ctx_is_admin() OR
        (auth_user_id::text = public.app_ctx_user_id() AND anonymous_id IS NULL) OR
        (auth_user_id IS NULL AND anonymous_id = public.app_ctx_guest_id()));

    ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
    ALTER TABLE payment_events FORCE ROW LEVEL SECURITY;
    CREATE POLICY payment_events_owner ON payment_events
      FOR ALL TO earth_app_runtime
      USING (public.app_ctx_is_admin() OR EXISTS (
        SELECT 1 FROM payment_orders o
        WHERE o.id = payment_events.payment_order_id AND (
          (o.auth_user_id::text = public.app_ctx_user_id() AND o.anonymous_id IS NULL) OR
          (o.auth_user_id IS NULL AND o.anonymous_id = public.app_ctx_guest_id())
        )
      ))
      WITH CHECK (public.app_ctx_is_admin() OR EXISTS (
        SELECT 1 FROM payment_orders o
        WHERE o.id = payment_events.payment_order_id AND (
          (o.auth_user_id::text = public.app_ctx_user_id() AND o.anonymous_id IS NULL) OR
          (o.auth_user_id IS NULL AND o.anonymous_id = public.app_ctx_guest_id())
        )
      ));

    ALTER TABLE app_inquiries ENABLE ROW LEVEL SECURITY;
    ALTER TABLE app_inquiries FORCE ROW LEVEL SECURITY;
    CREATE POLICY app_inquiries_owner ON app_inquiries
      FOR ALL TO earth_app_runtime
      USING (public.app_ctx_is_admin() OR
        (auth_user_id::text = public.app_ctx_user_id() AND anonymous_id IS NULL) OR
        (auth_user_id IS NULL AND anonymous_id = public.app_ctx_guest_id()))
      WITH CHECK (public.app_ctx_is_admin() OR
        (auth_user_id::text = public.app_ctx_user_id() AND anonymous_id IS NULL) OR
        (auth_user_id IS NULL AND anonymous_id = public.app_ctx_guest_id()));

    ALTER TABLE app_analytics_events ENABLE ROW LEVEL SECURITY;
    ALTER TABLE app_analytics_events FORCE ROW LEVEL SECURITY;
    CREATE POLICY app_analytics_events_owner ON app_analytics_events
      FOR ALL TO earth_app_runtime
      USING (public.app_ctx_is_admin() OR
        (auth_user_id::text = public.app_ctx_user_id() AND anonymous_id IS NULL) OR
        (auth_user_id IS NULL AND anonymous_id = public.app_ctx_guest_id()))
      WITH CHECK (public.app_ctx_is_admin() OR
        (auth_user_id::text = public.app_ctx_user_id() AND anonymous_id IS NULL) OR
        (auth_user_id IS NULL AND anonymous_id = public.app_ctx_guest_id()));

    ALTER TABLE app_push_subscriptions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE app_push_subscriptions FORCE ROW LEVEL SECURITY;
    CREATE POLICY app_push_subscriptions_owner ON app_push_subscriptions
      FOR ALL TO earth_app_runtime
      USING (public.app_ctx_is_admin() OR
        (auth_user_id::text = public.app_ctx_user_id() AND anonymous_id IS NULL) OR
        (auth_user_id IS NULL AND anonymous_id = public.app_ctx_guest_id()))
      WITH CHECK (public.app_ctx_is_admin() OR
        (auth_user_id::text = public.app_ctx_user_id() AND anonymous_id IS NULL) OR
        (auth_user_id IS NULL AND anonymous_id = public.app_ctx_guest_id()));

    ALTER TABLE free_message_usage ENABLE ROW LEVEL SECURITY;
    ALTER TABLE free_message_usage FORCE ROW LEVEL SECURITY;
    CREATE POLICY free_message_usage_owner ON free_message_usage
      FOR ALL TO earth_app_runtime
      USING (anonymous_id = public.app_ctx_guest_id() OR public.app_ctx_is_admin())
      WITH CHECK (anonymous_id = public.app_ctx_guest_id() OR public.app_ctx_is_admin());

    ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;
    ALTER TABLE api_rate_limits FORCE ROW LEVEL SECURITY;
    CREATE POLICY api_rate_limits_runtime ON api_rate_limits
      FOR ALL TO earth_app_runtime USING (true) WITH CHECK (true);

    ALTER TABLE immigration_sources ENABLE ROW LEVEL SECURITY;
    ALTER TABLE immigration_sources FORCE ROW LEVEL SECURITY;
    CREATE POLICY immigration_sources_read ON immigration_sources
      FOR SELECT TO earth_app_runtime USING (status = 'verified' OR public.app_ctx_is_admin());
    CREATE POLICY immigration_sources_admin_write ON immigration_sources
      FOR ALL TO earth_app_runtime
      USING (public.app_ctx_is_admin()) WITH CHECK (public.app_ctx_is_admin());

    ALTER TABLE immigration_source_versions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE immigration_source_versions FORCE ROW LEVEL SECURITY;
    CREATE POLICY immigration_source_versions_read ON immigration_source_versions
      FOR SELECT TO earth_app_runtime USING (
        public.app_ctx_is_admin() OR EXISTS (
          SELECT 1 FROM immigration_sources s
          WHERE s.id = immigration_source_versions.source_id AND s.status = 'verified'
        )
      );
    CREATE POLICY immigration_source_versions_admin_write ON immigration_source_versions
      FOR ALL TO earth_app_runtime
      USING (public.app_ctx_is_admin()) WITH CHECK (public.app_ctx_is_admin());

    ALTER TABLE immigration_source_reviews ENABLE ROW LEVEL SECURITY;
    ALTER TABLE immigration_source_reviews FORCE ROW LEVEL SECURITY;
    CREATE POLICY immigration_source_reviews_admin ON immigration_source_reviews
      FOR ALL TO earth_app_runtime
      USING (public.app_ctx_is_admin()) WITH CHECK (public.app_ctx_is_admin());

    ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
    ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
    CREATE POLICY audit_events_insert_own ON audit_events
      FOR INSERT TO earth_app_runtime
      WITH CHECK (actor_auth_user_id::text = public.app_ctx_user_id() OR public.app_ctx_is_admin());
    CREATE POLICY audit_events_read_admin ON audit_events
      FOR SELECT TO earth_app_runtime USING (public.app_ctx_is_admin());

    GRANT SELECT, INSERT ON app_user_profiles TO earth_app_runtime;
    GRANT SELECT ON legacy_account_imports TO earth_app_runtime;
    GRANT UPDATE (linked_auth_user_id, migration_status) ON legacy_account_imports TO earth_app_runtime;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO earth_app_runtime;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP POLICY IF EXISTS audit_events_read_admin ON audit_events;
    DROP POLICY IF EXISTS audit_events_insert_own ON audit_events;
    DROP POLICY IF EXISTS immigration_source_reviews_admin ON immigration_source_reviews;
    DROP POLICY IF EXISTS immigration_source_versions_admin_write ON immigration_source_versions;
    DROP POLICY IF EXISTS immigration_source_versions_read ON immigration_source_versions;
    DROP POLICY IF EXISTS immigration_sources_admin_write ON immigration_sources;
    DROP POLICY IF EXISTS immigration_sources_read ON immigration_sources;
    DROP POLICY IF EXISTS api_rate_limits_runtime ON api_rate_limits;
    DROP POLICY IF EXISTS free_message_usage_owner ON free_message_usage;
    DROP POLICY IF EXISTS app_push_subscriptions_owner ON app_push_subscriptions;
    DROP POLICY IF EXISTS app_analytics_events_owner ON app_analytics_events;
    DROP POLICY IF EXISTS app_inquiries_owner ON app_inquiries;
    DROP POLICY IF EXISTS payment_events_owner ON payment_events;
    DROP POLICY IF EXISTS payment_orders_owner ON payment_orders;
    DROP POLICY IF EXISTS chat_messages_owner ON chat_messages;
    DROP POLICY IF EXISTS chat_conversations_owner ON chat_conversations;
    DROP POLICY IF EXISTS legacy_account_imports_link ON legacy_account_imports;
    DROP POLICY IF EXISTS legacy_account_imports_claim ON legacy_account_imports;
    DROP POLICY IF EXISTS app_user_profiles_insert ON app_user_profiles;
    DROP POLICY IF EXISTS app_user_profiles_tenant ON app_user_profiles;
    ALTER TABLE audit_events NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE audit_events DISABLE ROW LEVEL SECURITY;
    ALTER TABLE immigration_source_reviews NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE immigration_source_reviews DISABLE ROW LEVEL SECURITY;
    ALTER TABLE immigration_source_versions NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE immigration_source_versions DISABLE ROW LEVEL SECURITY;
    ALTER TABLE immigration_sources NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE immigration_sources DISABLE ROW LEVEL SECURITY;
    ALTER TABLE api_rate_limits NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE api_rate_limits DISABLE ROW LEVEL SECURITY;
    ALTER TABLE free_message_usage NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE free_message_usage DISABLE ROW LEVEL SECURITY;
    ALTER TABLE app_push_subscriptions NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE app_push_subscriptions DISABLE ROW LEVEL SECURITY;
    ALTER TABLE app_analytics_events NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE app_analytics_events DISABLE ROW LEVEL SECURITY;
    ALTER TABLE app_inquiries NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE app_inquiries DISABLE ROW LEVEL SECURITY;
    ALTER TABLE payment_events NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE payment_events DISABLE ROW LEVEL SECURITY;
    ALTER TABLE payment_orders NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE payment_orders DISABLE ROW LEVEL SECURITY;
    ALTER TABLE chat_messages NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
    ALTER TABLE chat_conversations NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE chat_conversations DISABLE ROW LEVEL SECURITY;
    ALTER TABLE legacy_account_imports NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE legacy_account_imports DISABLE ROW LEVEL SECURITY;
    ALTER TABLE app_user_profiles NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE app_user_profiles DISABLE ROW LEVEL SECURITY;
    DROP FUNCTION IF EXISTS public.app_ctx_verified_email();
    DROP FUNCTION IF EXISTS public.app_ctx_is_admin();
    DROP FUNCTION IF EXISTS public.app_ctx_guest_id();
    DROP FUNCTION IF EXISTS public.app_ctx_user_id();
    REVOKE earth_app_runtime FROM PUBLIC;
    DROP ROLE IF EXISTS earth_app_runtime;
  `);
};
