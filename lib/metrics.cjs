'use strict';

const crypto = require('node:crypto');

const BUCKETS = [0.1, 0.3, 0.5, 1, 2.5, 5, 10];
const requests = new Map();
const durations = BUCKETS.map(le => ({ le, count: 0 }));
let requestCount = 0;
let durationSum = 0;

function middleware(req, res, next) {
  if (req.path === '/metrics') return next();
  const started = process.hrtime.bigint();
  res.once('finish', () => {
    const seconds = Number(process.hrtime.bigint() - started) / 1e9;
    const method = /^[A-Z]{1,10}$/.test(req.method) ? req.method : 'OTHER';
    const statusClass = Math.floor(res.statusCode / 100) + 'xx';
    const key = method + ':' + statusClass;
    requests.set(key, (requests.get(key) || 0) + 1);
    requestCount += 1;
    durationSum += seconds;
    for (const bucket of durations) {
      if (seconds <= bucket.le) bucket.count += 1;
    }
  });
  next();
}

function authorized(req) {
  const expected = process.env.METRICS_TOKEN;
  const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!expected || !supplied) return false;
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function render() {
  const memory = process.memoryUsage();
  const lines = [
    '# HELP process_uptime_seconds Process uptime in seconds.',
    '# TYPE process_uptime_seconds gauge',
    'process_uptime_seconds ' + process.uptime(),
    '# HELP process_resident_memory_bytes Resident memory in bytes.',
    '# TYPE process_resident_memory_bytes gauge',
    'process_resident_memory_bytes ' + memory.rss,
    '# HELP process_heap_used_bytes V8 heap used in bytes.',
    '# TYPE process_heap_used_bytes gauge',
    'process_heap_used_bytes ' + memory.heapUsed,
    '# HELP http_requests_total Completed HTTP requests by method and status class.',
    '# TYPE http_requests_total counter',
  ];
  for (const [key, value] of requests) {
    const [method, statusClass] = key.split(':');
    lines.push('http_requests_total{method="' + method + '",status_class="' + statusClass + '"} ' + value);
  }
  lines.push(
    '# HELP http_request_duration_seconds Request duration histogram.',
    '# TYPE http_request_duration_seconds histogram'
  );
  for (const bucket of durations) {
    lines.push('http_request_duration_seconds_bucket{le="' + bucket.le + '"} ' + bucket.count);
  }
  lines.push('http_request_duration_seconds_bucket{le="+Inf"} ' + requestCount);
  lines.push('http_request_duration_seconds_sum ' + durationSum);
  lines.push('http_request_duration_seconds_count ' + requestCount);
  return lines.join('\n') + '\n';
}

function handler(req, res) {
  if (!authorized(req)) {
    res.setHeader('Cache-Control', 'no-store');
    return res.sendStatus(404);
  }
  res.setHeader('Cache-Control', 'no-store');
  res.type('text/plain; version=0.0.4; charset=utf-8');
  return res.status(200).send(render());
}

module.exports = { middleware, handler };
