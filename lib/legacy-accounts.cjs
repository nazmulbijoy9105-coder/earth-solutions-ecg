'use strict';

const { withTransaction } = require('./db.cjs');

async function claimLegacyAccount({ authUserId, verifiedEmail }) {
  if (!authUserId || !verifiedEmail) throw new Error('Verified identity is required');

  return withTransaction(async client => {
    const lookup = await client.query(
      `SELECT legacy_id, display_name, legacy_role_label, legacy_status_label,
              migration_status, linked_auth_user_id
       FROM legacy_account_imports
       WHERE lower(email) = lower($1)
       FOR UPDATE`,
      [verifiedEmail]
    );
    const legacy = lookup.rows[0];
    if (!legacy) return { status: 'no_legacy_record' };
    if (legacy.migration_status === 'rejected') return { status: 'claim_rejected' };
    if (legacy.linked_auth_user_id && legacy.linked_auth_user_id !== authUserId) {
      return { status: 'already_linked_to_another_identity' };
    }

    // Legacy role labels are preserved for audit only. No legacy admin label
    // is allowed to grant an application role.
    const accountStatus = legacy.legacy_status_label === 'active' ? 'active' : 'suspended';
    await client.query(
      `INSERT INTO app_user_profiles (auth_user_id, display_name, role, account_status)
       VALUES ($1, $2, 'user', $3)
       ON CONFLICT (auth_user_id) DO NOTHING`,
      [authUserId, legacy.display_name, accountStatus]
    );

    await client.query(
      `UPDATE legacy_account_imports
       SET linked_auth_user_id = $1, migration_status = 'linked'
       WHERE legacy_id = $2 AND (linked_auth_user_id IS NULL OR linked_auth_user_id = $1)`,
      [authUserId, legacy.legacy_id]
    );

    await client.query(
      `INSERT INTO audit_events
        (actor_auth_user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'legacy_account_claimed', 'legacy_account', $2, $3::jsonb)`,
      [
        authUserId,
        legacy.legacy_id,
        JSON.stringify({
          legacyRoleLabel: legacy.legacy_role_label,
          legacyStatusLabel: legacy.legacy_status_label,
          assignedApplicationRole: 'user',
          assignedAccountStatus: accountStatus,
        }),
      ]
    );

    return {
      status: legacy.linked_auth_user_id === authUserId ? 'already_linked' : 'linked',
      accountStatus,
      applicationRole: 'user',
    };
  });
}

module.exports = { claimLegacyAccount };
