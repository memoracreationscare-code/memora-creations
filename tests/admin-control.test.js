'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const Module = require('node:module');

let saved = null;
let cookieSet = null;
const admin = { _id: 'a1', email: 'o@x.in', passwordHash: 'H:Oldpass1234', save: async function () { saved = this; } };

// No bcryptjs/mongoose in the sandbox: small stand-ins used by this test only.
const stubs = {
  bcryptjs: {
    compare: async (p, h) => h === 'H:' + p,
    hash: async p => 'H:' + p
  },
  '../models': { Admin: { findById: () => ({ select: async () => admin }) } },
  '../middleware/auth': { setAuthCookie: (res, p) => { cookieSet = p; } },
  '../utils/securityLog': { logSecurity() {} }
};
const orig = Module._load;
Module._load = function (request, ...rest) {
  if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
  return orig.call(this, request, ...rest);
};
test.after(() => { Module._load = orig; });

const ctl = require('../backend/controllers/adminPasswordController');

const call = body => new Promise(resolve => {
  const res = { json: b => resolve({ ok: true, b }), status() { return res; } };
  ctl.change({ admin: { _id: 'a1' }, body, headers: {}, ip: '1.1.1.1' }, res, err => resolve({ err }));
});

test('new password rules', () => {
  const f = ctl.checkNewPassword;
  assert.ok(f('Oldpass1234', 'short1'));
  assert.ok(f('Oldpass1234', 'onlyletterslong'));
  assert.ok(f('Oldpass1234', '12345678901'));
  assert.ok(f('Oldpass1234', 'Oldpass1234'));
  assert.strictEqual(f('Oldpass1234', 'Newpass98765'), '');
});

test('wrong current password is rejected, nothing saved', async () => {
  const r = await call({ currentPassword: 'nope', newPassword: 'Newpass98765' });
  assert.strictEqual(r.err.statusCode, 401);
  assert.strictEqual(saved, null);
});

test('weak new password is rejected', async () => {
  const r = await call({ currentPassword: 'Oldpass1234', newPassword: 'weak' });
  assert.strictEqual(r.err.statusCode, 400);
  assert.strictEqual(saved, null);
});

test('good change stamps passwordChangedAt and re-issues the cookie', async () => {
  const r = await call({ currentPassword: 'Oldpass1234', newPassword: 'Newpass98765' });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(saved.passwordHash, 'H:Newpass98765');
  assert.ok(saved.passwordChangedAt instanceof Date);
  assert.deepStrictEqual(cookieSet, { sub: 'a1', type: 'admin' });
});

test('5 wrong tries lock the account', async () => {
  admin.passwordHash = 'H:Newpass98765';
  for (let i = 0; i < 5; i += 1) await call({ currentPassword: 'bad', newPassword: 'x' });
  const r = await call({ currentPassword: 'Newpass98765', newPassword: 'Another12345' });
  assert.strictEqual(r.err.statusCode, 429);
});

test('route is wired and staff cannot reach it', () => {
  assert.match(fs.readFileSync('backend/routes/adminRoutes.js', 'utf8'), /post\('\/change-password'/);
  const { ALLOWED } = require('../backend/middleware/staffGuard');
  assert.ok(!ALLOWED.some(([m, re]) => m === 'POST' && re.test('/change-password')));
});

test('COD max amount: wired through settings, server check and checkout', () => {
  const svc = require('../backend/services/settingsService');
  assert.strictEqual(svc.defaults().codMaxAmount, 0);
  assert.match(fs.readFileSync('backend/controllers/adminSettingsController.js', 'utf8'), /codMaxAmount: \[0, 1000000\]/);
  assert.match(fs.readFileSync('backend/routes/settingsRoutes.js', 'utf8'), /codMaxAmount/);
  assert.match(fs.readFileSync('admin/settings.html', 'utf8'), /id="codMaxAmount"/);
  assert.match(fs.readFileSync('admin/js/settings.js', 'utf8'), /'codMaxAmount'/);
  assert.match(fs.readFileSync('frontend/js/checkout.js', 'utf8'), /applyCodLimit/);
});

test('assertCodWithinLimit blocks COD / COD-advance above the limit only', () => {
  const src = fs.readFileSync('backend/services/orderService.js', 'utf8');
  const m = src.match(/function assertCodWithinLimit[\s\S]*?\n}\n/);
  assert.ok(m);
  const make = max => new Function('require', 'error', m[0] + '; return assertCodWithinLimit;')(
    () => ({ peek: () => ({ codMaxAmount: max }) }),
    (code, msg) => Object.assign(new Error(msg), { statusCode: code })
  );
  const f = make(2000);
  assert.throws(() => f('COD', false, 2500), e => e.statusCode === 400);
  assert.throws(() => f('CASHFREE', true, 2500), e => e.statusCode === 400);
  assert.doesNotThrow(() => f('COD', false, 2000));
  assert.doesNotThrow(() => f('CASHFREE', false, 99999));
  assert.doesNotThrow(() => make(0)('COD', false, 99999));
});

test('FAQ: setting exists, is public, and is rendered with textContent', () => {
  assert.strictEqual(require('../backend/services/settingsService').defaults().faqText, '');
  assert.match(fs.readFileSync('backend/routes/settingsRoutes.js', 'utf8'), /faqText/);
  assert.match(fs.readFileSync('backend/controllers/adminSettingsController.js', 'utf8'), /faqText: 3000/);
  const js = fs.readFileSync('frontend/js/extras.js', 'utf8');
  const fn = js.match(/function applyFaq[\s\S]*?\n  }\n/)[0];
  assert.match(fn, /textContent/);
  assert.doesNotMatch(fn, /innerHTML/);
  assert.match(js, /applyFaq\(settings\)/);
});
