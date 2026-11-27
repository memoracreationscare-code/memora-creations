'use strict';

/*
  GET  /api/auth/parent-consent?token=...          who is asking (for the parent's page)
  POST /api/auth/parent-consent  { token, decision: 'approve' | 'deny' }
  POST /api/auth/parent-consent/resend  { mobile }  (answer is always the same)

  The link is a random 256-bit token; only its SHA-256 is stored, it works
  once, and it expires after 7 days.
*/

const { User } = require('../models');
const { asyncHandler, error, ok } = require('../utils/http');
const { validMobile } = require('../utils/validation');
const rules = require('../utils/parentConsent');
const mail = require('../services/mailService');

const SITE = (process.env.CLIENT_URL || 'https://memoracreationscare.in').replace(/\/$/, '');
const RESEND_GAP_MS = 2 * 60 * 1000;

async function sendConsentEmail(user, token) {
  try {
    const link = `${SITE}/frontend/parent-consent.html?token=${encodeURIComponent(token)}`;
    const msg = rules.consentEmail({
      parentName: user.parentConsent.parentName,
      childName: user.fullName,
      link
    });

    return Boolean(await mail.sendMail({ to: user.parentConsent.parentEmail, subject: msg.subject, html: msg.html }));
  } catch (err) {
    console.warn('[Parent consent] email failed:', err.message);
    return false;
  }
}

const findByToken = token => {
  const t = String(token || '');

  if (t.length < 40 || t.length > 200) return null;

  return User.findOne({
    'parentConsent.status': 'PENDING',
    'parentConsent.tokenHash': rules.hashToken(t),
    'parentConsent.tokenExpiresAt': { $gt: new Date() }
  }).select('+parentConsent.tokenHash +parentConsent.tokenExpiresAt');
};

const info = asyncHandler(async (req, res) => {
  const user = await findByToken(req.query.token);

  if (!user) throw error(400, 'Ye link galat hai, pehle hi use ho chuka hai ya expire ho gaya hai.');

  return ok(res, { childName: user.fullName, parentName: user.parentConsent.parentName });
});

const decide = asyncHandler(async (req, res) => {
  const decision = String((req.body || {}).decision || '');

  if (decision !== 'approve' && decision !== 'deny') throw error(400, 'Faisla chunein.');

  const user = await findByToken((req.body || {}).token);

  if (!user) throw error(400, 'Ye link galat hai, pehle hi use ho chuka hai ya expire ho gaya hai.');

  user.parentConsent.status = decision === 'approve' ? 'GRANTED' : 'DENIED';
  user.parentConsent.decidedAt = new Date();
  user.parentConsent.tokenHash = undefined;
  user.parentConsent.tokenExpiresAt = undefined;

  if (decision === 'deny') user.isActive = false;

  await user.save();

  return ok(res, {
    message: decision === 'approve'
      ? 'Dhanyavaad. Sahmati mil gayi, ab aapka bachcha apne account se login kar sakta hai.'
      : 'Theek hai. Sahmati nahi di gayi, ye account band kar diya gaya hai.'
  });
});

const resend = asyncHandler(async (req, res) => {
  const mobile = String((req.body || {}).mobile || '').trim();
  const same = { message: 'Agar ye mobile number sahmati ka intezaar kar raha hai, to parent ko naya link bhej diya gaya hai.' };

  if (!validMobile(mobile)) throw error(400, 'Sahi mobile number likhein.');

  const user = await User.findOne({ mobile, 'parentConsent.status': 'PENDING' });

  if (user) {
    const last = user.parentConsent.requestedAt ? user.parentConsent.requestedAt.getTime() : 0;

    if (Date.now() - last > RESEND_GAP_MS) {
      const t = rules.newToken();

      user.parentConsent.tokenHash = t.hash;
      user.parentConsent.tokenExpiresAt = new Date(Date.now() + rules.LINK_DAYS * 86400000);
      user.parentConsent.requestedAt = new Date();
      await user.save();
      await sendConsentEmail(user, t.token);
    }
  }

  return ok(res, same);
});

module.exports = { info, decide, resend, sendConsentEmail };
