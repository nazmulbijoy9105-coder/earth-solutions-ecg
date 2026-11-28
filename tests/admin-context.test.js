'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

test('verified admin middleware preserves admin AsyncLocalStorage context for downstream handlers', () => {
  const script = String.raw`
    const Module = require('node:module');
    const { AsyncLocalStorage } = require('node:async_hooks');
    const assert = require('node:assert/strict');
    const storage = new AsyncLocalStorage();
    const calls = [];
    const db = {
      withTenantContext(context, work) { return storage.run(context, work); },
      async query(sql) {
        if (storage.getStore()?.role !== 'admin') throw new Error('admin context missing');
        calls.push(sql);
        if (sql.includes('app_user_profiles')) {
          return { rows: [{ role: 'admin', account_status: 'active' }] };
        }
        return { rows: [] };
      },
    };
    const originalLoad = Module._load;
    Module._load = function(request, parent, isMain) {
      if (request === './db.cjs' && parent && parent.filename.endsWith('/lib/neon-auth.cjs')) return db;
      return originalLoad.call(this, request, parent, isMain);
    };
    const { requireAppAdmin } = require('./lib/neon-auth.cjs');
    const res = {
      headersSent: false,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; this.headersSent = true; },
    };
    requireAppAdmin({ auth: { id: '860dc360-609f-4b7d-9e70-ec93fe6414d3' } }, res, () => {
      (async () => {
        assert.equal(storage.getStore()?.role, 'admin');
        await db.query('SELECT privileged_admin_data');
        assert.equal(storage.getStore()?.role, 'admin');
        assert.equal(calls.length, 2);
        process.stdout.write('admin-context-preserved');
      })().catch(error => { process.stderr.write(error.stack); process.exitCode = 1; });
    });
    setTimeout(() => {
      if (!calls.length) { process.stderr.write('admin middleware did not invoke next'); process.exitCode = 1; }
    }, 100);
  `;
  const result = spawnSync(process.execPath, ['-e', script], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    timeout: 3000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /admin-context-preserved/);
});
