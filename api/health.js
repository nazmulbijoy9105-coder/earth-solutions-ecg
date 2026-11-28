const database = require('../lib/db.cjs');
const { runtimeConfigurationIssues } = require('../lib/runtime-config.cjs');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!database.isDatabaseConfigured()) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ status: 'degraded', database: 'not_configured' }));
  }
  if (runtimeConfigurationIssues({ ...process.env, NODE_ENV: 'production' }).length) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ status: 'degraded', reason: 'runtime_configuration_incomplete' }));
  }
  try {
    await database.healthCheck();
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ status: 'ok', database: 'ok' }));
  } catch {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ status: 'degraded', database: 'unavailable' }));
  }
}
