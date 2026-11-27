'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const Module = require('node:module');
const rules = require('../backend/utils/parentConsent');

const NOW = new Date('2026-11-27T06:00:00Z'); // 11:30 IST

test('date of birth: real dates only, sensible range', () => {
  assert.ok(rules.parseDob('2000-02-29'));
  assert.strictEqual(rules.parseDob('2001-02-29'), null);
  assert.strictEqual(rules.parseDob('2031-01-01', NOW), null);
  assert.strictEqual(rules.parseDob('1850-01-01', NOW), null);
  assert.strictEqual(rules.parseDob('2024-01-01', NOW), null); // under 5
  assert.strictEqual(rules.parseDob('27-11-2000'), null);
  assert.strictEqual(rules.parseDob("2000-01-01'; drop"), null);
});

test('age is exact on the birthday (India time)', () => {
  const dob = d => new Date(d + 'T00:00:00Z');
  assert.strictEqual(rules.isMinor(dob('2008-11-28'), NOW), true);  // turns 18 tomorrow
  assert.strictEqual(rules.isMinor(dob('2008-11-27'), NOW), false); // turns 18 today
  assert.strictEqual(rules.isMinor(dob('2008-11-26'), NOW), false);
  assert.strictEqual(rules.isMinor(dob('2015-06-01'), NOW), true);
  // 20:00 UTC on 26th is already 27th in India
  assert.strictEqual(rules.isMinor(dob('2008-11-27'), new Date('2026-11-26T20:00:00Z')), false);
});

test('token: random, only the hash is kept, email text is escaped', () => {
  const a = rules.newToken(); const b = rules.newToken();
  assert.notStrictEqual(a.token, b.token);
  assert.strictEqual(a.token.length, 64);
  assert.strictEqual(a.hash, rules.hashToken(a.token));
  assert.notStrictEqual(a.hash, a.token);
  const m = rules.consentEmail({ parentName: '<b>x</b>', childName: '"><script>', link: 'https://x/y?token=1' });
  assert.ok(!m.html.includes('<script>') && !m.html.includes('<b>x</b>'));
});

/* ---- controller behaviour with a tiny fake database ---- */
let users = [];
let mails = [];
const orig = Module._load;
const stubs = {
  '../models': {
    User: {
      findOne(q) {
        const hit = users.find(u =>
          (q.mobile === undefined || u.mobile === q.mobile) &&
          (q['parentConsent.status'] === undefined || (u.parentConsent && u.parentConsent.status === q['parentConsent.status'])) &&
          (q['parentConsent.tokenHash'] === undefined || (u.parentConsent && u.parentConsent.tokenHash === q['parentConsent.tokenHash'])) &&
          (!q['parentConsent.tokenExpiresAt'] || u.parentConsent.tokenExpiresAt > q['parentConsent.tokenExpiresAt'].$gt));
        const r = Promise.resolve(hit || null);
        r.select = () => Promise.resolve(hit || null);
        return r;
      }
    }
  },
  '../utils/validation': { validMobile: m => /^[6-9]\d{9}$/.test(String(m)) }, // 'validator' package is not in the sandbox
  '../services/mailService': { sendMail: async m => { mails.push(m); return true; } }
};
Module._load = function (request, ...rest) {
  if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
  return orig.call(this, request, ...rest);
};
test.after(() => { Module._load = orig; });

const ctl = require('../backend/controllers/parentConsentController');
const run = (fn, req) => new Promise(resolve => {
  const res = { json: b => resolve({ ok: true, b }), status() { return res; } };
  fn({ body: {}, query: {}, ...req }, res, err => resolve({ err }));
});

function child() {
  const t = rules.newToken();
  const u = {
    fullName: 'Riya', mobile: '9876543210', isActive: true,
    parentConsent: { required: true, status: 'PENDING', parentName: 'Mrs Rao', parentEmail: 'p@x.in', tokenHash: t.hash, tokenExpiresAt: new Date(Date.now() + 86400000), requestedAt: new Date(Date.now() - 3600000) },
    save: async function () { return this; }
  };
  users = [u];
  return { u, token: t.token };
}

test('approve unlocks the account and the link works only once', async () => {
  const { u, token } = child();
  const info = await run(ctl.info, { query: { token } });
  assert.strictEqual(info.b.childName, 'Riya');
  const r = await run(ctl.decide, { body: { token, decision: 'approve' } });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(u.parentConsent.status, 'GRANTED');
  assert.strictEqual(u.isActive, true);
  assert.strictEqual(u.parentConsent.tokenHash, undefined);
  assert.strictEqual((await run(ctl.decide, { body: { token, decision: 'approve' } })).err.statusCode, 400);
});

test('deny closes the account', async () => {
  const { u, token } = child();
  await run(ctl.decide, { body: { token, decision: 'deny' } });
  assert.strictEqual(u.parentConsent.status, 'DENIED');
  assert.strictEqual(u.isActive, false);
});

test('wrong, short or expired tokens and bad decisions are refused', async () => {
  const { u, token } = child();
  assert.strictEqual((await run(ctl.decide, { body: { token: 'abc', decision: 'approve' } })).err.statusCode, 400);
  assert.strictEqual((await run(ctl.decide, { body: { token: 'f'.repeat(64), decision: 'approve' } })).err.statusCode, 400);
  assert.strictEqual((await run(ctl.decide, { body: { token, decision: 'maybe' } })).err.statusCode, 400);
  u.parentConsent.tokenExpiresAt = new Date(Date.now() - 1000);
  assert.strictEqual((await run(ctl.decide, { body: { token, decision: 'approve' } })).err.statusCode, 400);
  assert.strictEqual(u.parentConsent.status, 'PENDING');
});

test('resend: new link to the parent, old one dies, 2-minute gap, same answer for strangers', async () => {
  const { u, token } = child();
  mails = [];
  const before = u.parentConsent.tokenHash;
  const r = await run(ctl.resend, { body: { mobile: '9876543210' } });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(mails.length, 1);
  assert.strictEqual(mails[0].to, 'p@x.in');
  assert.notStrictEqual(u.parentConsent.tokenHash, before);
  assert.strictEqual((await run(ctl.info, { query: { token } })).err.statusCode, 400);
  await run(ctl.resend, { body: { mobile: '9876543210' } });
  assert.strictEqual(mails.length, 1, 'second request inside 2 minutes sends nothing');
  const stranger = await run(ctl.resend, { body: { mobile: '9000000000' } });
  assert.strictEqual(stranger.b.message, r.b.message);
  assert.strictEqual(mails.length, 1);
  assert.strictEqual((await run(ctl.resend, { body: { mobile: '123' } })).err.statusCode, 400);
});

test('wired: register asks for DOB + parent, login and sessions block pending, pages exist', () => {
  const auth = fs.readFileSync('backend/controllers/authController.js', 'utf8');
  assert.match(auth, /parseDob\(req\.body\.dateOfBirth\)/);
  assert.match(auth, /status === 'PENDING'/);
  assert.match(auth, /pendingParentConsent: true/);
  const reg = auth.slice(auth.indexOf('const register'), auth.indexOf('const login'));
  assert.ok(reg.indexOf('if (minor)') < reg.indexOf('setAuthCookie'), 'minor returns before any login cookie');
  assert.match(fs.readFileSync('backend/middleware/auth.js', 'utf8'), /\['PENDING', 'DENIED'\]/);
  assert.match(fs.readFileSync('backend/routes/authRoutes.js', 'utf8'), /parent-consent\/resend/);
  const su = fs.readFileSync('frontend/signup.html', 'utf8');
  for (const n of ['dateOfBirth', 'parentName', 'parentEmail', 'parentConsentDeclared']) assert.ok(su.includes(`name="${n}"`), n);
  assert.ok(fs.existsSync('frontend/parent-consent.html'));
  assert.match(fs.readFileSync('frontend/login.html', 'utf8'), /parentResendBtn/);
});

test('no marketing to under-18 accounts', () => {
  for (const f of ['notificationSweeper', 'pushSweeper', 'priceDropSweeper']) {
    assert.match(fs.readFileSync(`backend/services/${f}.js`, 'utf8'), /parentConsent/, f);
  }
});
