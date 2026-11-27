'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const net = require('node:net');
const path = require('node:path');
const { after, before, test } = require('node:test');

const root = path.resolve(__dirname, '..');
let child;
let baseUrl;

async function getFreePort() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const { port } = listener.address();
  await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  return port;
}

before(async () => {
  const port = await getFreePort();
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      DATABASE_URL: '',
      ADMIN_PASSWORD: 'test-only-password-123',
      GROQ_API_KEY: ''
    },
    stdio: 'ignore'
  });

  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited before becoming ready (code ${child.exitCode})`);
    }
    try {
      const response = await fetch(`${baseUrl}/index.html`);
      if (response.ok) return;
    } catch {
      // The server is not listening yet.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  child.kill('SIGKILL');
  throw new Error('Server did not become ready within 15 seconds');
}, { timeout: 20000 });

after(async () => {
  if (!child || child.exitCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  await Promise.race([
    exited,
    new Promise(resolve => setTimeout(resolve, 2000))
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
});

test('public homepage and allowlisted assets remain available', async () => {
  for (const pathname of ['/index.html', '/', '/style.css', '/frontend/chat.js', '/frontend/homepage.js', '/frontend/chat-pdf.js', '/frontend/neon-auth.js', '/frontend/pricing.js', '/pricing.html', '/admin.html', '/admin', '/logo.jpg', '/manifest.json', '/sw.js']) {
    const response = await fetch(`${baseUrl}${pathname}`);
    assert.equal(response.status, 200, `${pathname} should be publicly available`);
  }
});

test('public HTML uses CSP-compatible external event handlers', async () => {
  const homepage = await fetch(`${baseUrl}/index.html`);
  const policy = homepage.headers.get('content-security-policy') || '';
  assert.match(policy, /default-src 'self'/);
  assert.match(policy, /script-src 'self' https:\/\/esm\.sh/);
  assert.doesNotMatch(policy, /script-src[^;]*unsafe-inline/);

  for (const pathname of ['/index.html', '/pricing.html', '/admin.html']) {
    const response = await fetch(`${baseUrl}${pathname}`);
    const html = await response.text();
    assert.doesNotMatch(html, /\son[a-z]+\s*=/i, `${pathname} must not contain inline event handlers`);
    assert.doesNotMatch(html, /<script(?![^>]*src=)[^>]*>/i, `${pathname} must not contain inline script blocks`);
  }
});

test('private data and server implementation files are not served', async () => {
  const privatePaths = [
    '/data/users.json',
    '/data/inquiries.json',
    '/data/push_subscriptions.json',
    '/data/analytics.json',
    '/data%2Fusers.json',
    '/%2564ata/users.json',
    '/data%252Fusers.json',
    '/server.js',
    '/user-routes.js',
    '/api/chat.js',
    '/lib/ai-core.js',
    '/package.json',
    '/package-lock.json',
    '/vercel.json',
    '/frontend/auth-client.js',
    '/migrations/1789504075584_init-schema.js'
  ];

  for (const pathname of privatePaths) {
    const response = await fetch(`${baseUrl}${pathname}`);
    assert.ok([400, 404].includes(response.status), `${pathname} should not be publicly served (received ${response.status})`);
  }
});

test('Express API routes still reach their handlers', async () => {
  const response = await fetch(`${baseUrl}/api/push/vapid-public-key`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(typeof body.key, 'string');
});


test('production health fails closed without PostgreSQL and legacy admin login is retired', async () => {
  const health = await fetch(`${baseUrl}/api/health`);
  assert.equal(health.status, 503);
  const login = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'legacy-password' }),
  });
  assert.equal(login.status, 410);
});


test('Express chat fallback emits standards-compliant SSE delimiters', async () => {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 'anon_1234567890123456',
      conversationId: '123e4567-e89b-42d3-a456-426614174000',
      messageId: '123e4567-e89b-42d3-a456-426614174001',
      messages: [{ role: 'user', content: 'A question outside the FAQ catalog' }],
    }),
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /text\/event-stream/);
  const output = await response.text();
  assert.match(output, /data: \{.*\}\n\n/);
  assert.match(output, /data: \[DONE\]\n\n$/);
  assert.equal(output.includes(String.fromCharCode(92) + 'n'), false);
});
