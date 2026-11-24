'use strict';

/*
  POST /api/admin/change-password   { currentPassword, newPassword }

  The owner changes his own admin password from Settings. Needs the current
  password (so a stolen open browser cannot change it), makes every older
  login stop working, and keeps this browser logged in.
*/

const bcrypt = require('bcryptjs');
const { asyncHandler, error, ok } = require('../utils/http');

const FAILS = new Map(); // adminId -> { n, until }
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

function checkNewPassword(current, next) {
  const text = String(next || '');

  if (text.length < 10) return 'Naya password kam se kam 10 akshar ka rakhein.';
  if (text.length > 100) return 'Naya password bahut lamba hai (100 akshar tak).';
  if (!/[A-Za-z]/.test(text) || !/[0-9]/.test(text)) return 'Naye password me akshar aur number dono hone chahiye.';
  if (text === String(current || '')) return 'Naya password purane se alag rakhein.';

  return '';
}

function locked(id, now) {
  const f = FAILS.get(id);

  return !!(f && f.n >= MAX_FAILS && f.until > now);
}

function noteFail(id, now) {
  const f = FAILS.get(id);

  if (!f || f.until <= now) FAILS.set(id, { n: 1, until: now + LOCK_MS });
  else f.n += 1;
}

const change = asyncHandler(async (req, res) => {
  const { Admin } = require('../models');
  const { setAuthCookie } = require('../middleware/auth');
  const id = String(req.admin && req.admin._id);
  const now = Date.now();

  if (locked(id, now)) {
    throw error(429, 'Bahut galat koshish. 15 minute baad dobara try karein.');
  }

  const current = String((req.body || {}).currentPassword || '');
  const next = String((req.body || {}).newPassword || '');
  const admin = await Admin.findById(id).select('+passwordHash');

  if (!admin || !current || !(await bcrypt.compare(current, admin.passwordHash))) {
    noteFail(id, now);
    require('../utils/securityLog').logSecurity('ADMIN_PASSWORD_CHANGE_FAILED', req, admin && admin.email);
    throw error(401, 'Abhi ka password galat hai.');
  }

  const problem = checkNewPassword(current, next);

  if (problem) throw error(400, problem);

  admin.passwordHash = await bcrypt.hash(next, 12);
  admin.passwordChangedAt = new Date();
  await admin.save();

  FAILS.delete(id);

  // Older logins stop working; give this browser a fresh one.
  setAuthCookie(res, { sub: String(admin._id), type: 'admin' });

  return ok(res, { message: 'Password badal gaya. Baaki sab purane login band ho gaye.' });
});

module.exports = { change, checkNewPassword };
