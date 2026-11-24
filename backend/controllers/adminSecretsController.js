'use strict';

/*
  GET  /api/admin/secrets   -> where each key comes from (never the secret itself)
  POST /api/admin/secrets   { password, updates: { NAME: value | null } }

  Owner only (staff are blocked by staffGuard). Saving needs the owner's
  admin password again, and 5 wrong tries lock it for 15 minutes.
*/

const bcrypt = require('bcryptjs');
const { asyncHandler, error, ok } = require('../utils/http');
const secrets = require('../services/secretsService');

const FAILS = new Map();
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

const list = asyncHandler(async (_req, res) => ok(res, { fields: secrets.status() }));

const update = asyncHandler(async (req, res) => {
  const { Admin } = require('../models');
  const id = String(req.admin && req.admin._id);
  const now = Date.now();
  const f = FAILS.get(id);

  if (f && f.n >= MAX_FAILS && f.until > now) {
    throw error(429, 'Bahut galat koshish. 15 minute baad dobara try karein.');
  }

  const { clean, error: problem } = secrets.validate((req.body || {}).updates);

  if (problem) throw error(400, problem);

  const password = String((req.body || {}).password || '');
  const admin = await Admin.findById(id).select('+passwordHash');

  if (!admin || !password || !(await bcrypt.compare(password, admin.passwordHash))) {
    if (!f || f.until <= now) FAILS.set(id, { n: 1, until: now + LOCK_MS });
    else f.n += 1;

    require('../utils/securityLog').logSecurity('SECRETS_PASSWORD_WRONG', req, admin && admin.email);
    throw error(401, 'Admin password galat hai.');
  }

  FAILS.delete(id);

  await secrets.save(clean);

  require('../utils/securityLog').logSecurity('SECRETS_CHANGED', req, Object.keys(clean).join(','));

  return ok(res, { fields: secrets.status(), message: 'Save ho gaya. Ab website nayi keys use kar rahi hai.' });
});

module.exports = { list, update };
