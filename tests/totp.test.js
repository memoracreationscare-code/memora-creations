'use strict';

const test = require('node:test');
const assert = require('node:assert');
const totp = require('../backend/utils/totp');

// RFC 6238 test secret "12345678901234567890"
const RFC = totp.base32Encode(Buffer.from('12345678901234567890'));

test('matches the RFC 6238 test vector', () => {
  assert.strictEqual(totp.codeAt(RFC, Math.floor(59 / 30)), '287082');
  assert.strictEqual(totp.codeAt(RFC, Math.floor(1111111109 / 30)), '081804');
});

test('base32 round trip and generated secret', () => {
  const s = totp.generateSecret();
  assert.match(s, /^[A-Z2-7]{32}$/);
  assert.strictEqual(totp.base32Encode(totp.base32Decode(s)), s);
});

test('verify accepts a current or neighbouring code, rejects wrong, bad format and replays', () => {
  const now = 1111111109 * 1000;
  const step = totp.stepOf(now);
  assert.strictEqual(totp.verify(RFC, '081804', { now }), step);
  assert.strictEqual(totp.verify(RFC, totp.codeAt(RFC, step - 1), { now }), step - 1);
  assert.strictEqual(totp.verify(RFC, totp.codeAt(RFC, step - 2), { now }), null);
  assert.strictEqual(totp.verify(RFC, '000000', { now }), null);
  assert.strictEqual(totp.verify(RFC, 'abc', { now }), null);
  assert.strictEqual(totp.verify(RFC, '081804', { now, afterStep: step }), null);
});

test('secret box encrypts and decrypts, and refuses tampering', () => {
  process.env.JWT_SECRET = 'x'.repeat(40);
  const box = require('../backend/utils/secretBox');
  const sealed = box.seal('ABCDEF');
  assert.ok(!sealed.includes('ABCDEF'));
  assert.strictEqual(box.open(sealed), 'ABCDEF');
  assert.throws(() => box.open(sealed.slice(0, -2) + 'AA'));
});
