'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const c = require('../backend/controllers/adminConnectionsController');

const sr = (over = {}) => ({ configured: () => true, getWalletBalance: async () => ({ data: { balance_amount: 1200 } }), ...over });
const cf = (status, env = 'production') => ({ pingCashfree: async () => ({ status, env }) });
const settings = low => ({ peek: () => ({ shiprocketLowBalance: low }) });
const mailOk = { provider: () => 'resend' };

test('wallet amount is read from the known shapes', () => {
  assert.strictEqual(c.walletOf({ data: { balance_amount: '250.5' } }), 250.5);
  assert.strictEqual(c.walletOf({ balance: 10 }), 10);
  assert.strictEqual(c.walletOf({}), null);
});

test('healthy shop: all ok, balance shown', async () => {
  const r = await c.gather({ sr: sr(), cf: cf(404), settings: settings(500), mail: mailOk });
  assert.deepStrictEqual(r.summary, { bad: 0, warn: 0 });
  assert.strictEqual(r.checks.length, 3);
  assert.match(r.checks[0].detail, /1200/);
});

test('low wallet raises an alert; limit 0 switches it off', async () => {
  const low = sr({ getWalletBalance: async () => ({ balance_amount: 120 }) });
  assert.strictEqual((await c.gather({ sr: low, cf: cf(404), settings: settings(500), mail: mailOk })).checks[0].level, 'bad');
  assert.strictEqual((await c.gather({ sr: low, cf: cf(404), settings: settings(0), mail: mailOk })).checks[0].level, 'ok');
});

test('shiprocket failure and missing login are reported, not thrown', async () => {
  const bad = await c.gather({ sr: sr({ getWalletBalance: async () => { throw new Error('boom'); } }), cf: cf(404), settings: settings(500), mail: mailOk });
  assert.strictEqual(bad.checks[0].level, 'bad');
  const none = await c.gather({ sr: sr({ configured: () => false }), cf: cf(404), settings: settings(500), mail: mailOk });
  assert.match(none.checks[0].detail, /set nahi/);
});

test('cashfree: wrong keys bad, sandbox warn, 5xx warn, missing keys bad', async () => {
  assert.strictEqual((await c.checkCashfree(cf(401))).level, 'bad');
  assert.strictEqual((await c.checkCashfree(cf(403))).level, 'bad');
  assert.strictEqual((await c.checkCashfree(cf(404, 'sandbox'))).level, 'warn');
  assert.strictEqual((await c.checkCashfree(cf(503))).level, 'warn');
  const none = await c.checkCashfree({ pingCashfree: async () => { throw Object.assign(new Error('x'), { statusCode: 503 }); } });
  assert.strictEqual(none.level, 'bad');
});

test('no secret ever appears in the answer', async () => {
  process.env.SHIPROCKET_PASSWORD = 'SUPERSECRETPW';
  process.env.CASHFREE_CLIENT_SECRET = 'SUPERSECRETCF';
  const r = JSON.stringify(await c.gather({ sr: sr(), cf: cf(404), settings: settings(500), mail: mailOk }));
  assert.ok(!r.includes('SUPERSECRET'));
});

test('route, setting and dashboard are wired; staff cannot reach it', () => {
  assert.match(fs.readFileSync('backend/routes/adminRoutes.js', 'utf8'), /'\/connections'/);
  assert.match(fs.readFileSync('admin/dashboard.html', 'utf8'), /connections-live\.js/);
  assert.match(fs.readFileSync('admin/settings.html', 'utf8'), /id="shiprocketLowBalance"/);
  assert.match(fs.readFileSync('backend/controllers/adminSettingsController.js', 'utf8'), /shiprocketLowBalance: \[0, 1000000\]/);
  const { ALLOWED } = require('../backend/middleware/staffGuard');
  assert.ok(!ALLOWED.some(([m, re]) => m === 'GET' && re.test('/connections')));
});

test('mail check: not set up is bad, wrong Brevo key bad, good key ok, outage only warns', async () => {
  assert.strictEqual((await c.checkMail({ provider: () => null })).level, 'bad');
  process.env.BREVO_API_KEY = 'k';
  const brevo = { provider: () => 'brevo' };
  assert.strictEqual((await c.checkMail(brevo, async () => ({ status: 401, ok: false }))).level, 'bad');
  assert.strictEqual((await c.checkMail(brevo, async () => ({ status: 200, ok: true }))).level, 'ok');
  assert.strictEqual((await c.checkMail(brevo, async () => ({ status: 500, ok: false }))).level, 'warn');
  assert.strictEqual((await c.checkMail(brevo, async () => { throw new Error('net'); })).level, 'warn');
  const out = JSON.stringify(await c.checkMail(brevo, async () => ({ status: 200, ok: true })));
  assert.ok(!out.includes('"k"'));
});

test('test email: needs setup, valid address, shows the provider error, masks the address', async () => {
  const Module = require('node:module');
  let cfg = false; let boom = null; const sent = [];
  const orig = Module._load;
  Module._load = function (request, ...rest) {
    if (request === '../services/mailService') return { mailConfigured: () => cfg, sendMail: async m => { if (boom) throw new Error(boom); sent.push(m); return true; } };
    return orig.call(this, request, ...rest);
  };
  try {
    const call = body => new Promise(resolve => {
      const res = { json: b => resolve({ ok: true, b }), status() { return res; } };
      c.testEmail({ admin: { email: 'owner@x.in' }, body }, res, err => resolve({ err }));
    });
    assert.strictEqual((await call({})).err.statusCode, 400);              // not set up
    cfg = true;
    assert.strictEqual((await call({ to: 'not-an-email' })).err.statusCode, 400);
    const good = await call({});
    assert.strictEqual(good.ok, true);
    assert.strictEqual(sent[0].to, 'owner@x.in');
    assert.strictEqual(good.b.to, 'o***@x.in');
    boom = 'Email provider refused (400) sender not valid';
    const bad = await call({ to: 'a@b.in' });
    assert.strictEqual(bad.err.statusCode, 422, 'not 5xx: the server would hide the text');
    assert.match(bad.err.message, /sender not valid/);
    assert.match(bad.err.message, /verify/);
    boom = 'Email provider refused (401) Key not found';
    assert.match((await call({ to: 'a@b.in' })).err.message, /API key/);
  } finally { Module._load = orig; }
});

test('test-email route and page button are wired, owner only', () => {
  assert.match(fs.readFileSync('backend/routes/adminRoutes.js', 'utf8'), /post\('\/test-email'/);
  assert.match(fs.readFileSync('admin/connections.html', 'utf8'), /id="testBtn"/);
  const { ALLOWED } = require('../backend/middleware/staffGuard');
  assert.ok(!ALLOWED.some(([, re]) => re.test('/test-email')));
});
