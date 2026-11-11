'use strict';

const test = require('node:test');
const assert = require('node:assert');

process.env.JWT_SECRET = 'y'.repeat(40);

const totp = require('../backend/utils/totp');
const box = require('../backend/utils/secretBox');
const service = require('../backend/services/adminTwoFactor');

function fakeAdmin(recoveryCodes = []) {
  const secret = totp.generateSecret();
  const admin = {
    _id: 'a1',
    twoFactor: { enabled: true, secretEnc: box.seal(secret), recoveryHashes: recoveryCodes.map(service.hashCode), lastStep: -1 }
  };
  const Admin = {
    updateOne: async (filter, update) => {
      if (update.$set?.['twoFactor.lastStep'] !== undefined) admin.twoFactor.lastStep = update.$set['twoFactor.lastStep'];
      if (update.$pull) {
        const h = update.$pull['twoFactor.recoveryHashes'];
        const before = admin.twoFactor.recoveryHashes.length;
        admin.twoFactor.recoveryHashes = admin.twoFactor.recoveryHashes.filter(x => x !== h);
        return { modifiedCount: before - admin.twoFactor.recoveryHashes.length };
      }
      return { modifiedCount: 1 };
    }
  };

  return { admin, Admin, secret };
}

test('a current authenticator code logs in once; the same code cannot be reused', async () => {
  const { admin, Admin, secret } = fakeAdmin();
  const code = totp.codeAt(secret, totp.stepOf());

  assert.strictEqual(await service.verifyLogin(Admin, admin, code), true);
  assert.strictEqual(await service.verifyLogin(Admin, admin, code), false);
});

test('wrong or empty codes are refused', async () => {
  const { admin, Admin } = fakeAdmin();

  assert.strictEqual(await service.verifyLogin(Admin, admin, '000000'), false);
  assert.strictEqual(await service.verifyLogin(Admin, admin, ''), false);
  assert.strictEqual(await service.verifyLogin(Admin, { _id: 'x', twoFactor: {} }, '123456'), false);
});

test('recovery codes work exactly once', async () => {
  const codes = service.newRecoveryCodes(3);
  const { admin, Admin } = fakeAdmin(codes);

  assert.match(codes[0], /^[a-f0-9]{5}-[a-f0-9]{5}$/);
  assert.strictEqual(await service.verifyLogin(Admin, admin, codes[1].toUpperCase()), true);
  assert.strictEqual(await service.verifyLogin(Admin, admin, codes[1]), false);
  assert.strictEqual(admin.twoFactor.recoveryHashes.length, 2);
});

test('recovery codes are stored only as hashes', () => {
  const [code] = service.newRecoveryCodes(1);

  assert.ok(!service.hashCode(code).includes(code.replace('-', '')));
  assert.strictEqual(service.hashCode(code), service.hashCode(code.toUpperCase().replace('-', ' ')));
});
