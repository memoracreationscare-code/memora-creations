'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { logSecurity, mask, resetForTests } = require('../backend/utils/securityLog');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const req = { ip: '1.2.3.4', method: 'POST', originalUrl: '/api/auth/login?x=1' };

function quiet(fn) {
  const w = console.warn;
  console.warn = () => {};
  try { return fn(); } finally { console.warn = w; }
}

test('mask hides most of a mobile/email', () => {
  assert.strictEqual(mask('9876543210'), '98***10');
  assert.strictEqual(mask('abc'), '***');
  assert.strictEqual(mask(''), '');
});

test('writes one line with no query string and a masked identity', () => {
  resetForTests();
  const rows = [];
  const ok = quiet(() => logSecurity('LOGIN_FAILED', req, '9876543210', { ActivityLog: { create: async r => rows.push(r) } }));
  assert.strictEqual(ok, true);
  assert.strictEqual(rows[0].admin, 'SECURITY');
  assert.strictEqual(rows[0].action, 'LOGIN_FAILED (98***10)');
  assert.strictEqual(rows[0].path, '/api/auth/login');
  assert.ok(!JSON.stringify(rows[0]).includes('9876543210'));
});

test('same event from same IP is throttled for 5 minutes', () => {
  resetForTests();
  const rows = [];
  const deps = { ActivityLog: { create: async r => rows.push(r) }, now: () => 1000 };
  quiet(() => {
    assert.strictEqual(logSecurity('RATE_LIMITED', req, '', deps), true);
    assert.strictEqual(logSecurity('RATE_LIMITED', req, '', deps), false);
    assert.strictEqual(logSecurity('RATE_LIMITED', req, '', { ...deps, now: () => 1000 + 5 * 60 * 1000 + 1 }), true);
    assert.strictEqual(logSecurity('RATE_LIMITED', { ...req, ip: '9.9.9.9' }, '', deps), true);
  });
  assert.strictEqual(rows.length, 3);
});

test('a broken database never breaks the request', () => {
  resetForTests();
  assert.doesNotThrow(() => quiet(() => logSecurity('LOGIN_FAILED', req, 'x', { ActivityLog: { create: () => { throw new Error('db down'); } } })));
  resetForTests();
  assert.doesNotThrow(() => quiet(() => logSecurity('LOGIN_FAILED', req, 'x', { ActivityLog: { create: () => Promise.reject(new Error('db down')) } })));
});

test('server is wired: headers, limiter handlers, origin blocks', () => {
  const s = read('backend/server.js');
  assert.match(s, /default-src 'none'; frame-ancestors 'none'/);
  assert.match(s, /Permissions-Policy/);
  assert.match(s, /private, no-store/);
  assert.strictEqual((s.match(/handler: onLimit/g) || []).length, 4);
  assert.strictEqual((s.match(/logSecurity\('BLOCKED_ORIGIN'/g) || []).length, 3);
});

test('login failures are logged', () => {
  assert.match(read('backend/controllers/authController.js'), /logSecurity\('LOGIN_FAILED'/);
  const a = read('backend/controllers/adminController.js');
  assert.match(a, /logSecurity\('ADMIN_LOGIN_FAILED'/);
  assert.match(a, /logSecurity\('ADMIN_OTP_FAILED'/);
});

test('no unused nodemailer dependency and no secrets in .env.example', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(!pkg.dependencies.nodemailer);
  assert.ok(!/(sk-|rzp_live|cfsk_)/.test(read('.env.example')));
});
