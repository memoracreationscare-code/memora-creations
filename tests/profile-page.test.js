'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const html = fs.readFileSync('frontend/profile.html', 'utf8');

test('profile page keeps every form/field the script depends on', () => {
  for (const id of ['profileForm', 'fullName', 'mobile', 'email', 'addressForm', 'addresses', 'profileSummary',
    'profileAvatar', 'avatarPick', 'avatarFile', 'avatarRemove', 'profileLogoutBtn', 'isDefault']) {
    assert.ok(html.includes(`id="${id}"`), `missing #${id}`);
  }
});

test('new-address form is collapsible and the toggle is wired', () => {
  assert.match(html, /address-form-card is-collapsed/);
  assert.ok(html.includes('id="addAddressToggle"'));
  assert.match(html, /aria-controls="addressForm"/);
});

test('customer care sits after the address form (balanced desktop columns)', () => {
  assert.ok(html.indexOf('id="addressForm"') < html.indexOf('profile-support-card'));
});
