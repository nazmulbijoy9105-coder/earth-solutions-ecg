import database from '../lib/db.cjs';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!database.isDatabaseConfigured()) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ status: 'degraded', database: 'not_configured' }));
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
