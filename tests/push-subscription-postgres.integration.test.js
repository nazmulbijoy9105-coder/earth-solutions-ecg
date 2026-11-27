'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Client } = require('pg');

test('a push endpoint cannot be reassigned to a different anonymous identity', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const dbPath = require.resolve('../lib/db.cjs');
  const persistencePath = require.resolve('../lib/persistence.cjs');
  const originalDb = require(dbPath);
  const originalPersistence = require.cache[persistencePath];
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  require.cache[dbPath].exports = {
    ...originalDb,
    query: (sql, params = []) => client.query(sql, params),
  };
  delete require.cache[persistencePath];
  const persistence = require('../lib/persistence.cjs');

  const owner = 'guest_' + randomUUID().replace(/-/g, '');
  const attacker = 'guest_' + randomUUID().replace(/-/g, '');
  const endpoint = 'https://push.example.test/' + randomUUID();
  const original = {
    endpoint,
    keys: { p256dh: 'public-key-a', auth: 'auth-secret-a' },
  };
  const replacement = {
    endpoint,
    keys: { p256dh: 'public-key-b', auth: 'auth-secret-b' },
  };

  try {
    await persistence.savePushSubscription({ subscription: original, userId: owner, stage: 4, lang: 'en' });

    await assert.rejects(
      () => persistence.savePushSubscription({ subscription: replacement, userId: attacker, stage: 7, lang: 'bn' }),
      /already owned by another identity/
    );

    const afterRejectedTransfer = await client.query(
      'SELECT anonymous_id, subscription FROM app_push_subscriptions WHERE endpoint = $1',
      [endpoint]
    );
    assert.equal(afterRejectedTransfer.rows[0].anonymous_id, owner);
    assert.deepEqual(afterRejectedTransfer.rows[0].subscription, original);

    await persistence.savePushSubscription({ subscription: replacement, userId: owner, stage: 7, lang: 'bn' });
    const afterSameOwnerUpdate = await client.query(
      'SELECT anonymous_id, subscription, stage, lang FROM app_push_subscriptions WHERE endpoint = $1',
      [endpoint]
    );
    assert.equal(afterSameOwnerUpdate.rows[0].anonymous_id, owner);
    assert.deepEqual(afterSameOwnerUpdate.rows[0].subscription, replacement);
    assert.equal(afterSameOwnerUpdate.rows[0].stage, 7);
    assert.equal(afterSameOwnerUpdate.rows[0].lang, 'bn');
  } finally {
    await client.query('DELETE FROM app_push_subscriptions WHERE endpoint = $1', [endpoint]);
    await client.end();
    require.cache[dbPath].exports = originalDb;
    delete require.cache[persistencePath];
    if (originalPersistence) require.cache[persistencePath] = originalPersistence;
  }
});
