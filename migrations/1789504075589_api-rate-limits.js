exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE api_rate_limits (
      bucket_key char(64) NOT NULL,
      window_start timestamptz NOT NULL,
      request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (bucket_key, window_start)
    );
    CREATE INDEX api_rate_limits_window_idx ON api_rate_limits (window_start);
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS api_rate_limits');
};
