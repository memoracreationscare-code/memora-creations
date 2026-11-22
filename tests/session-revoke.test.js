'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

process.env.JWT_SECRET = 'z'.repeat(40);

// The sandbox has no jsonwebtoken/mongoose: tiny stand-ins for this test only.
const stubs = {
  jsonwebtoken: { verify: token => JSON.parse(token), sign: () => '' },
  '../models': {
    User: { findById: async id => global.__acct },
    Admin: { findById: async id => global.__acct }
  }
};
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
  return origLoad.call(this, request, ...rest);
};
const auth = require('../backend/middleware/auth');
Module._load = origLoad;

const iat = 1_800_000_000;
const res = () => {
  const r = { code: 0, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } };
  return r;
};

async function run(fn, type, account) {
  global.__acct = account;
  const req = { cookies: { [type === 'admin' ? 'memora_admin_token' : 'memora_user_token']: JSON.stringify({ type, sub: 'x', iat }) } };
  const r = res();
  let nexted = false;
  await fn(req, r, () => { nexted = true; });
  return { nexted, r };
}

test('issuedBeforePasswordChange compares token time with password time', () => {
  const f = auth.issuedBeforePasswordChange;
  assert.strictEqual(f({ iat }, { passwordChangedAt: null }), false);
  assert.strictEqual(f({ iat }, {}), false);
  assert.strictEqual(f({ iat }, { passwordChangedAt: new Date((iat + 60) * 1000) }), true);
  assert.strictEqual(f({ iat }, { passwordChangedAt: new Date(iat * 1000 + 500) }), false);
  assert.strictEqual(f({ iat: iat + 10 }, { passwordChangedAt: new Date(iat * 1000) }), false);
});

test('customer with an old cookie is signed out after a password change', async () => {
  const old = await run(auth.requireUser, 'user', { isActive: true, passwordChangedAt: new Date((iat + 100) * 1000) });
  assert.strictEqual(old.nexted, false);
  assert.strictEqual(old.r.code, 401);

  const fresh = await run(auth.requireUser, 'user', { isActive: true, passwordChangedAt: new Date((iat - 100) * 1000) });
  assert.strictEqual(fresh.nexted, true);

  const never = await run(auth.requireUser, 'user', { isActive: true });
  assert.strictEqual(never.nexted, true);
});

test('admin with an old cookie is signed out after a password change', async () => {
  const old = await run(auth.requireAdmin, 'admin', { isActive: true, passwordChangedAt: new Date((iat + 100) * 1000) });
  assert.strictEqual(old.nexted, false);
  assert.strictEqual(old.r.code, 401);

  const fresh = await run(auth.requireAdmin, 'admin', { isActive: true });
  assert.strictEqual(fresh.nexted, true);
});

test('every place that sets a new password also stamps passwordChangedAt', () => {
  const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  for (const f of ['backend/controllers/authController.js', 'backend/controllers/adminController.js', 'backend/controllers/adminStaffController.js']) {
    assert.match(read(f), /passwordChangedAt = new Date\(\)/, f);
  }
});

test('Dependabot is set up for npm and GitHub Actions', () => {
  const y = fs.readFileSync(path.join(__dirname, '..', '.github/dependabot.yml'), 'utf8');
  assert.match(y, /package-ecosystem: "npm"/);
  assert.match(y, /package-ecosystem: "github-actions"/);
});
