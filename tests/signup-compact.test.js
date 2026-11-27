'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');

const page = fs.readFileSync('frontend/signup.html', 'utf8');
const auth = fs.readFileSync('backend/controllers/authController.js', 'utf8');

test('sign-up page: short, no marketing panel, optional parts folded away', () => {
  for (const gone of ['signup-brand-panel', 'signup-benefit', 'signup-security', 'signup-kicker', 'Join Our']) {
    assert.ok(!page.includes(gone), gone + ' removed');
  }
  assert.match(page, /<details class="signup-more" id="addrMore">/);
  assert.match(page, /<details class="signup-more" id="refMore">/);
  const addr = page.slice(page.indexOf('id="addrMore"'), page.indexOf('id="refMore"'));
  assert.ok(!/\brequired\b/.test(addr), 'address fields are not required');
});

test('every field the form needs is still there with the same name', () => {
  for (const n of ['fullName', 'mobile', 'email', 'password', 'dateOfBirth', 'addressLine', 'pinCode', 'city', 'state', 'referralCode', 'parentName', 'parentEmail', 'parentConsentDeclared']) {
    assert.ok(page.includes(`name="${n}"`), n);
  }
  assert.match(page, /id="toggleSignupPassword"/);
  assert.match(page, /id="signupForm"/);
});

test('server: address is optional, but if given it must be complete and valid', () => {
  assert.match(auth, /const hasAddress = Boolean\(/);
  assert.match(auth, /hasAddress &&/);
  assert.match(auth, /addresses: !hasAddress \? \[\] : \[/);
});
