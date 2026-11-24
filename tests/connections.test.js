'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const c = require('../backend/controllers/adminConnectionsController');

const sr = (over = {}) => ({ configured: () => true, getWalletBalance: async () => ({ data: { balance_amount: 1200 } }), ...over });
const cf = (status, env = 'production') => ({ pingCashfree: async () => ({ status, env }) });
const settings = low => ({ peek: () => ({ shiprocketLowBalance: low }) });

test('wallet amount is read from the known shapes', () => {
  assert.strictEqual(c.walletOf({ data: { balance_amount: '250.5' } }), 250.5);
  assert.strictEqual(c.walletOf({ balance: 10 }), 10);
  assert.strictEqual(c.walletOf({}), null);
});

test('healthy shop: all ok, balance shown', async () => {
  const r = await c.gather({ sr: sr(), cf: cf(404), settings: settings(500) });
  assert.deepStrictEqual(r.summary, { bad: 0, warn: 0 });
  assert.match(r.checks[0].detail, /1200/);
});

test('low wallet raises an alert; limit 0 switches it off', async () => {
  const low = sr({ getWalletBalance: async () => ({ balance_amount: 120 }) });
  assert.strictEqual((await c.gather({ sr: low, cf: cf(404), settings: settings(500) })).checks[0].level, 'bad');
  assert.strictEqual((await c.gather({ sr: low, cf: cf(404), settings: settings(0) })).checks[0].level, 'ok');
});

test('shiprocket failure and missing login are reported, not thrown', async () => {
  const bad = await c.gather({ sr: sr({ getWalletBalance: async () => { throw new Error('boom'); } }), cf: cf(404), settings: settings(500) });
  assert.strictEqual(bad.checks[0].level, 'bad');
  const none = await c.gather({ sr: sr({ configured: () => false }), cf: cf(404), settings: settings(500) });
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
  const r = JSON.stringify(await c.gather({ sr: sr(), cf: cf(404), settings: settings(500) }));
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
