const neonAuth = require('../../lib/neon-auth.cjs');
const legacyAccounts = require('../../lib/legacy-accounts.cjs');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    return res.end(JSON.stringify({ error: 'Method not allowed' }));
  }

  const header = req.headers.authorization || '';
  const match = /^Bearer\\s+(.+)$/i.exec(header);
  if (!match) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: 'Authentication required' }));
  }

  try {
    const user = await neonAuth.verifyNeonToken(match[1]);
    if (!user.email || user.emailVerified !== true) {
      res.statusCode = 403;
      return res.end(JSON.stringify({ error: 'A verified email address is required' }));
    }
    const result = await legacyAccounts.claimLegacyAccount({ authUserId: user.id, verifiedEmail: user.email });
    res.statusCode = result.status === 'no_legacy_record' ? 404 :
      result.status === 'claim_rejected' ? 403 :
      result.status === 'already_linked_to_another_identity' ? 409 : 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify(result));
  } catch (error) {
    const unavailable = error instanceof neonAuth.AuthConfigurationError || error instanceof neonAuth.AuthProviderUnavailableError;
    res.statusCode = unavailable ? 503 : 503;
    return res.end(JSON.stringify({ error: 'Account claim service unavailable' }));
  }
}
