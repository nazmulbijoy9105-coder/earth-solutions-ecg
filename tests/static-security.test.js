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
      ADMIN_PASSWORD: 'test-only-password-123'
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

test('public homepage remains available', async () => {
  const response = await fetch(`${baseUrl}/index.html`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /text\/html/);
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
    '/vercel.json'
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
