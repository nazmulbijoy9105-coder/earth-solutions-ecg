exports.shorthands = undefined;

// Extend the daily quota ledger to authenticated Neon Auth users while keeping
// signed guest identities as a distinct ownership namespace.
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE free_message_usage DROP CONSTRAINT free_message_usage_pkey;
    ALTER TABLE free_message_usage ALTER COLUMN anonymous_id DROP NOT NULL;
    ALTER TABLE free_message_usage DROP CONSTRAINT free_message_usage_anonymous_id_check;
    ALTER TABLE free_message_usage ADD CONSTRAINT free_message_usage_anonymous_id_check
      CHECK (anonymous_id IS NULL OR (left(anonymous_id, 6) = 'guest_' AND length(anonymous_id) BETWEEN 38 AND 86));
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

// Rollback is intentionally guarded: account-owned quota rows cannot be
// represented by the prior guest-only schema. Operators must export or
// reconcile those rows before reverting this migration.
exports.down = (pgm) => {
  pgm.sql(`
    DO $rollback$
    BEGIN
      IF EXISTS (SELECT 1 FROM free_message_usage WHERE auth_user_id IS NOT NULL) THEN
        RAISE EXCEPTION 'Cannot roll back account-owned quota rows without an explicit data migration';
      END IF;
    END
    $rollback$;
    DROP POLICY IF EXISTS free_message_usage_owner ON free_message_usage;
    ALTER TABLE free_message_usage DROP CONSTRAINT free_message_usage_exactly_one_owner;
    DROP INDEX IF EXISTS free_message_usage_guest_message_uq;
    DROP INDEX IF EXISTS free_message_usage_user_message_uq;
    ALTER TABLE free_message_usage DROP COLUMN auth_user_id;
    ALTER TABLE free_message_usage ALTER COLUMN anonymous_id SET NOT NULL;
    ALTER TABLE free_message_usage ADD PRIMARY KEY (anonymous_id, client_message_id);
    ALTER TABLE free_message_usage ADD CONSTRAINT free_message_usage_anonymous_id_check
      CHECK (left(anonymous_id, 6) = 'guest_' AND length(anonymous_id) BETWEEN 38 AND 86);
    CREATE POLICY free_message_usage_owner ON free_message_usage
      FOR ALL TO earth_app_runtime
      USING (anonymous_id = public.app_ctx_guest_id() OR public.app_ctx_is_admin())
      WITH CHECK (anonymous_id = public.app_ctx_guest_id() OR public.app_ctx_is_admin());
  `);
};
