exports.shorthands = undefined;

// Server-enforced free-tier usage. The composite primary key makes retries
// with the same client message ID idempotent; the application serializes
// per-guest quota checks with a PostgreSQL transaction advisory lock.
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE free_message_usage (
      anonymous_id text NOT NULL CHECK (anonymous_id ~ '^anon_[A-Za-z0-9_-]{16,100}$'),
      client_message_id uuid NOT NULL,
      usage_date date NOT NULL DEFAULT current_date,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (anonymous_id, client_message_id)
    );
    CREATE INDEX free_message_usage_owner_day_idx
      ON free_message_usage (anonymous_id, usage_date);
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS free_message_usage');
};
