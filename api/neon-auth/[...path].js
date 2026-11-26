const authProxy = require('../../lib/auth-proxy.cjs');

module.exports = async function handler(req, res) {
  const rawPath = req.query && req.query.path;
  const suffix = Array.isArray(rawPath) ? rawPath.join('/') : (rawPath || '');
  return authProxy(req, res, suffix);
}
