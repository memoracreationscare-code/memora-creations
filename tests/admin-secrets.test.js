'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const Module = require('node:module');

process.env.JWT_SECRET = 'k'.repeat(40);

let doc = null;
let resets = 0;
const stubs = {
  bcryptjs: { compare: async (p, h) => h === 'H:' + p },
  '../models/SecretVault': {
    findOne: () => ({ lean: async () => doc }),
    findOneAndUpdate: (_q, op) => ({
      lean: async () => {
        doc = doc || { values: {} };
        for (const [k, v] of Object.entries(op.$set || {})) doc.values[k.replace('values.', '')] = v;
        for (const k of Object.keys(op.$unset || {})) delete doc.values[k.replace('values.', '')];
        return doc;
      }
    })
  },
  '../models': { Admin: { findById: () => ({ select: async () => ({ _id: 'a1', email: 'o@x.in', passwordHash: 'H:RightPass123' }) }) } },
  '../utils/securityLog': { logSecurity() {} },
  './shiprocketService': { resetShiprocketToken: () => { resets += 1; } }
};
const orig = Module._load;
Module._load = function (request, ...rest) {
  if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
  return orig.call(this, request, ...rest);
};
test.after(() => { Module._load = orig; });

const secrets = require('../backend/services/secretsService');
const ctl = require('../backend/controllers/adminSecretsController');
const call = body => new Promise(resolve => {
  const res = { json: b => resolve({ ok: true, b }), status() { return res; } };
  ctl.update({ admin: { _id: 'a1' }, body, ip: '1.1.1.1' }, res, err => resolve({ err }));
});

test('only listed keys, one-line values, valid mode', () => {
  assert.ok(secrets.validate({ JWT_SECRET: 'x' }).error);
  assert.ok(secrets.validate({ MONGODB_URI: 'x' }).error);
  assert.ok(secrets.validate({ CASHFREE_ENV: 'live' }).error);
  assert.ok(secrets.validate({ SHIPROCKET_EMAIL: 'no-at-sign' }).error);
  assert.ok(secrets.validate({ GEMINI_API_KEY: 'a\nb' }).error);
  assert.ok(secrets.validate({}).error);
  assert.deepStrictEqual(secrets.validate({ CASHFREE_ENV: 'production', GEMINI_API_KEY: null }).clean, { CASHFREE_ENV: 'production', GEMINI_API_KEY: null });
});

test('wrong admin password changes nothing', async () => {
  const r = await call({ password: 'nope', updates: { GEMINI_API_KEY: 'AIza-secret-1' } });
  assert.strictEqual(r.err.statusCode, 401);
  assert.strictEqual(doc, null);
  assert.strictEqual(process.env.GEMINI_API_KEY, undefined);
});

test('saved key is encrypted at rest, used by the app, and never shown back', async () => {
  const r = await call({ password: 'RightPass123', updates: { GEMINI_API_KEY: 'AIza-secret-1', SHIPROCKET_PICKUP_LOCATION: 'Home' } });
  assert.strictEqual(r.ok, true);
  assert.ok(!JSON.stringify(doc).includes('AIza-secret-1'), 'stored encrypted');
  assert.strictEqual(process.env.GEMINI_API_KEY, 'AIza-secret-1');
  assert.ok(resets >= 1, 'shiprocket token forgotten');

  const out = JSON.stringify(r.b);
  assert.ok(!out.includes('AIza-secret-1'));
  const gem = r.b.fields.find(f => f.name === 'GEMINI_API_KEY');
  assert.strictEqual(gem.source, 'panel');
  assert.strictEqual(gem.value, undefined);
  assert.strictEqual(r.b.fields.find(f => f.name === 'SHIPROCKET_PICKUP_LOCATION').value, 'Home');
});

test('removing the panel value brings the Render value back', async () => {
  process.env.CASHFREE_CLIENT_ID = 'render-id';
  await call({ password: 'RightPass123', updates: { CASHFREE_CLIENT_ID: 'panel-id' } });
  assert.strictEqual(process.env.CASHFREE_CLIENT_ID, 'panel-id');
  await call({ password: 'RightPass123', updates: { CASHFREE_CLIENT_ID: null } });
  assert.strictEqual(process.env.CASHFREE_CLIENT_ID, 'render-id');

  await call({ password: 'RightPass123', updates: { GEMINI_API_KEY: null } });
  assert.strictEqual(process.env.GEMINI_API_KEY, undefined);
});

test('after a restart the saved keys are applied again; a broken one falls back', async () => {
  await call({ password: 'RightPass123', updates: { BREVO_API_KEY: 'brevo-1' } });
  delete process.env.BREVO_API_KEY;
  await secrets.applyAll();
  assert.strictEqual(process.env.BREVO_API_KEY, 'brevo-1');

  doc.values.BREVO_API_KEY = 'garbage.not.sealed';
  await secrets.applyAll();
  assert.strictEqual(process.env.BREVO_API_KEY, undefined);
});

test('5 wrong passwords lock the page', async () => {
  for (let i = 0; i < 5; i += 1) await call({ password: 'bad', updates: { GEMINI_API_KEY: 'x' } });
  const r = await call({ password: 'RightPass123', updates: { GEMINI_API_KEY: 'x' } });
  assert.strictEqual(r.err.statusCode, 429);
});

test('wired: routes, owner-only, nav link, page exists', () => {
  const routes = fs.readFileSync('backend/routes/adminRoutes.js', 'utf8');
  assert.match(routes, /get\('\/secrets'/);
  assert.match(routes, /post\('\/secrets'/);
  const { ALLOWED } = require('../backend/middleware/staffGuard');
  assert.ok(!ALLOWED.some(([, re]) => re.test('/secrets')));
  assert.match(fs.readFileSync('admin/js/nav.js', 'utf8'), /connections\.html/);
  assert.match(fs.readFileSync('backend/server.js', 'utf8'), /secretsService'\)\.applyAll/);
  assert.ok(fs.existsSync('admin/connections.html'));
});
