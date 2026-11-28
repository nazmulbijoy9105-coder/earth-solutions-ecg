exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE chat_messages ADD COLUMN client_message_id uuid;
    CREATE UNIQUE INDEX chat_messages_client_idempotency_uq
      ON chat_messages (conversation_id, client_message_id)
      WHERE client_message_id IS NOT NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS chat_messages_client_idempotency_uq;
    ALTER TABLE chat_messages DROP COLUMN IF EXISTS client_message_id;
  `);
};
