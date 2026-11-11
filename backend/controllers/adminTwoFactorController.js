'use strict';

/* Admin panel: turn 2-step login on / off. All calls need an admin session. */

const bcrypt = require('bcryptjs');
const { Admin } = require('../models');
const { asyncHandler, error, ok } = require('../utils/http');
const totp = require('../utils/totp');
const box = require('../utils/secretBox');
const service = require('../services/adminTwoFactor');

const FIELDS = '+twoFactor.enabled +twoFactor.secretEnc +twoFactor.recoveryHashes +twoFactor.lastStep';

const status = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.admin._id).select(FIELDS);

  return ok(res, {
    enabled: Boolean(admin?.twoFactor?.enabled),
    recoveryLeft: admin?.twoFactor?.recoveryHashes?.length || 0,
    emergencyOff: process.env.ADMIN_2FA_DISABLE === 'true'
  });
});

// Step 1: make a key. Nothing changes for login until it is confirmed in step 2.
const setup = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.admin._id).select(FIELDS);

  if (admin?.twoFactor?.enabled) throw error(400, '2-step login pehle se chalu hai.');

  const secret = totp.generateSecret();

  await Admin.updateOne({ _id: admin._id }, {
    $set: { 'twoFactor.enabled': false, 'twoFactor.secretEnc': box.seal(secret), 'twoFactor.recoveryHashes': [], 'twoFactor.lastStep': -1 }
  });

  return ok(res, { secret, otpauth: totp.otpauthUrl(secret, admin.email) });
});

// Step 2: the owner types the first code from the app - proves it works before it is switched on.
const enable = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.admin._id).select(FIELDS);

  if (!admin?.twoFactor?.secretEnc) throw error(400, 'Pehle "chalu karo" se key banayein.');
  if (admin.twoFactor.enabled) throw error(400, '2-step login pehle se chalu hai.');

  const step = totp.verify(box.open(admin.twoFactor.secretEnc), req.body?.code);

  if (step === null) throw error(400, 'Code galat hai. App me dikh raha naya 6 digit code daalein.');

  const codes = service.newRecoveryCodes();

  await Admin.updateOne({ _id: admin._id }, {
    $set: { 'twoFactor.enabled': true, 'twoFactor.recoveryHashes': codes.map(service.hashCode), 'twoFactor.lastStep': step }
  });

  return ok(res, { message: '2-step login chalu ho gaya.', recoveryCodes: codes });
});

// Turning it off needs the password AND a current code (or a recovery code).
const disable = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.admin._id).select('+passwordHash ' + FIELDS);

  if (!admin?.twoFactor?.enabled) throw error(400, '2-step login chalu nahi hai.');
  if (!(await bcrypt.compare(String(req.body?.password || ''), admin.passwordHash))) throw error(401, 'Password galat hai.');
  if (!(await service.verifyLogin(Admin, admin, String(req.body?.code || '')))) throw error(401, 'Code galat hai.');

  await Admin.updateOne({ _id: admin._id }, { $unset: { twoFactor: 1 } });

  return ok(res, { message: '2-step login band ho gaya.' });
});

module.exports = { status, setup, enable, disable };
