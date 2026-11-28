'use strict';

// Use the address resolved by Express's explicitly configured trusted-proxy
// chain, or the direct socket peer in serverless handlers. Never trust a raw
// client-supplied X-Forwarded-For value for security decisions.
function getTrustedClientIp(req) {
  const candidate = typeof req?.ip === 'string' && req.ip
    ? req.ip
    : (typeof req?.socket?.remoteAddress === 'string' ? req.socket.remoteAddress : '');
  return candidate.slice(0, 64);
}

module.exports = { getTrustedClientIp };
