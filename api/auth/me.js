import neonAuth from '../../lib/neon-auth.cjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
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
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ user }));
  } catch (error) {
    res.statusCode = error?.name === 'AuthConfigurationError' || error?.name === 'AuthProviderUnavailableError' ? 503 : 401;
    return res.end(JSON.stringify({ error: res.statusCode === 503 ? 'Authentication service unavailable' : 'Invalid or expired session' }));
  }
}
