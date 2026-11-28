'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const Module = require('node:module');

let users = [];
let mails = [];
const orig = Module._load;
const stubs = {
  bcryptjs: { hash: async v => 'H:' + v, compare: async () => false }, // not installed in the sandbox
  '../models': { User: { findOne: async q => users.find(u => u.mobile === q.mobile) || null } },
  '../utils/validation': {
    validMobile: m => /^[6-9]\d{9}$/.test(String(m)),
    validEmail: () => true, validPin: () => true, cleanString: (v, n) => String(v == null ? '' : v).trim().slice(0, n)
  },
  '../middleware/auth': { setAuthCookie() {}, clearAuthCookie() {}, setAuthCookies() {} }, // 'jsonwebtoken' is not installed in the sandbox
  './mailService': {
    mailConfigured: () => true,
    sendMail: async m => { mails.push(m); return true; }
  }
};
Module._load = function (request, ...rest) {
  if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
  return orig.call(this, request, ...rest);
};
test.after(() => { Module._load = orig; });

const { forgotPassword } = require('../backend/controllers/authController');

const mk = (over = {}) => ({
  fullName: 'Rahul', mobile: '9794511901', email: 'r@x.in', isActive: true,
  passwordResetRequestedAt: null, saves: 0,
  save: async function () { this.saves += 1; },
  ...over
});
const ask = mobile => new Promise(resolve => {
  const res = { json: b => resolve({ ok: true, b }), status() { return res; } };
  forgotPassword({ body: { mobile } }, res, err => resolve({ err }));
});

test('customer with an email gets the link at once; admin still sees the request', async () => {
  const u = mk(); users = [u]; mails = [];
  const r = await ask('9794511901');
  assert.strictEqual(r.ok, true);
  assert.match(r.b.message, /email par bhej diya gaya/);
  assert.strictEqual(mails.length, 1);
  assert.strictEqual(mails[0].to, 'r@x.in');
  assert.match(mails[0].html, /reset-password\.html\?token=[0-9a-f]{64}/);
  assert.match(mails[0].html, /request ki thi/, 'self-request wording');
  assert.match(mails[0].html, /1 ghante/, 'email states the real 1-hour lifetime');
  assert.ok(u.passwordResetRequestedAt instanceof Date);
  assert.strictEqual(u.passwordResetTokenHash.length, 64);
  const hours = (u.passwordResetExpiresAt - Date.now()) / 3600000;
  assert.ok(hours > 0.9 && hours <= 1, 'link lasts 1 hour');
});

test('same answer for unknown numbers and customers without email; nothing is sent to them', async () => {
  users = [mk({ email: '' })]; mails = [];
  const noEmail = await ask('9794511901');
  const stranger = await ask('9000000000');
  assert.strictEqual(noEmail.b.message, stranger.b.message);
  assert.strictEqual(mails.length, 0);
  assert.ok(users[0].passwordResetRequestedAt, 'admin still sees the request');
});

test('at most one mail every 2 minutes per customer', async () => {
  users = [mk()]; mails = [];
  await ask('9794511901');
  await ask('9794511901');
  assert.strictEqual(mails.length, 1);
  users[0].passwordResetRequestedAt = new Date(Date.now() - 3 * 60 * 1000);
  await ask('9794511901');
  assert.strictEqual(mails.length, 2);
});

test('disabled or parent-locked accounts get no link', async () => {
  users = [mk({ isActive: false })]; mails = [];
  await ask('9794511901');
  users = [mk({ parentConsent: { status: 'PENDING' } })];
  await ask('9794511901');
  assert.strictEqual(mails.length, 0);
});

test('bad mobile is refused', async () => {
  assert.strictEqual((await ask('123')).err.statusCode, 400);
});

test('page wording no longer says "contact support first"', () => {
  const page = fs.readFileSync('frontend/forgot-password.html', 'utf8');
  assert.doesNotMatch(page, /hamari team\s+aapke account ke liye naya password set karegi/);
  assert.doesNotMatch(page, /admin panel\s+me pahunch jayegi/);
  assert.match(page, /link\s+aapke registered email par bhej diya jayega/);
});
