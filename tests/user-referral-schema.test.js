'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '../backend/models/User.js'), 'utf8');

test('referral fields belong to the User schema, not the address schema', () => {
  const userStart = src.indexOf('const userSchema');
  assert.ok(userStart > 0);

  for (const field of ['referralCode', 'referredBy', 'referralRewarded']) {
    const at = src.indexOf(field + ':');
    assert.ok(at > userStart, field + ' must be declared inside userSchema');
  }
});
