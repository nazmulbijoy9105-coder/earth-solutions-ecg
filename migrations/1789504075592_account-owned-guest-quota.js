exports.shorthands = undefined;

// Allow quota records to belong to either a signed guest identity or a
// verified Neon Auth user. Replace the nullable guest-only PK with partial
// unique indexes so each identity namespace has correct idempotency.
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE free_message_usage DROP CONSTRAINT free_message_usage_pkey;
    ALTER TABLE free_message_usage ALTER COLUMN anonymous_id DROP NOT NULL;
    ALTER TABLE free_message_usage
      ADD COLUMN auth_user_id uuid REFERENCES neon_auth."user"(id) ON DELETE CASCADE;
    ALTER TABLE free_message_usage
      ADD CONSTRAINT free_message_usage_exactly_one_owner
      CHECK ((auth_user_id IS NOT NULL AND anonymous_id IS NULL) OR
             (auth_user_id IS NULL AND anonymous_id IS NOT NULL));
    CREATE UNIQUE INDEX free_message_usage_guest_message_uq
      ON free_message_usage (anonymous_id, client_message_id)
      WHERE anonymous_id IS NOT NULL;
    CREATE UNIQUE INDEX free_message_usage_user_message_uq
      ON free_message_usage (auth_user_id, client_message_id)
      WHERE auth_user_id IS NOT NULL;
    DROP POLICY IF EXISTS free_message_usage_owner ON free_message_usage;
    CREATE POLICY free_message_usage_owner ON free_message_usage
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
  `);
};
exports.down = (pgm) => {
  pgm.sql(`
    DROP POLICY IF EXISTS free_message_usage_owner ON free_message_usage;
    ALTER TABLE free_message_usage DROP CONSTRAINT free_message_usage_exactly_one_owner;
    DROP INDEX IF EXISTS free_message_usage_guest_message_uq;
    DROP INDEX IF EXISTS free_message_usage_user_message_uq;
    ALTER TABLE free_message_usage DROP COLUMN auth_user_id;
    DELETE FROM free_message_usage WHERE anonymous_id IS NULL;
    ALTER TABLE free_message_usage ALTER COLUMN anonymous_id SET NOT NULL;
    ALTER TABLE free_message_usage ADD PRIMARY KEY (anonymous_id, client_message_id);
    CREATE POLICY free_message_usage_owner ON free_message_usage
      FOR ALL TO earth_app_runtime
      USING (anonymous_id = public.app_ctx_guest_id() OR public.app_ctx_is_admin())
      WITH CHECK (anonymous_id = public.app_ctx_guest_id() OR public.app_ctx_is_admin());
  `);
};
