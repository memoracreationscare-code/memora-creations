'use strict';

/*
  2-step login for the admin (authenticator app + one-time recovery codes).
  The key is stored encrypted; recovery codes are stored only as hashes.
*/

const crypto = require('crypto');
const totp = require('../utils/totp');
const box = require('../utils/secretBox');

const hashCode = code => crypto.createHash('sha256').update(String(code).replace(/[^a-z0-9]/gi, '').toLowerCase()).digest('hex');

function newRecoveryCodes(count = 8) {
  return Array.from({ length: count }, () => {
    const raw = crypto.randomBytes(5).toString('hex');

    return raw.slice(0, 5) + '-' + raw.slice(5);
  });
}

// true when `input` is a valid authenticator code (not used before) or an unused recovery code
async function verifyLogin(Admin, admin, input) {
  const tf = admin.twoFactor || {};

  if (!tf.secretEnc) return false;

  const step = totp.verify(box.open(tf.secretEnc), input, { afterStep: Number.isFinite(tf.lastStep) ? tf.lastStep : -1 });

  if (step !== null) {
    await Admin.updateOne({ _id: admin._id }, { $set: { 'twoFactor.lastStep': step } });

    return true;
  }

  const hash = hashCode(input);

  if ((tf.recoveryHashes || []).includes(hash)) {
    const used = await Admin.updateOne({ _id: admin._id, 'twoFactor.recoveryHashes': hash }, { $pull: { 'twoFactor.recoveryHashes': hash } });

    return (used.modifiedCount ?? used.nModified ?? 0) > 0;
  }

  return false;
}

module.exports = { verifyLogin, newRecoveryCodes, hashCode };
