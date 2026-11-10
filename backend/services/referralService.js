'use strict';

/*
  First-order (WELCOME) discount and Refer & Earn.

  - WELCOME: one coupon, kept in step with Store Settings. Works only on a
    customer's first order.
  - Refer & Earn: every customer has a code. A friend who signs up with it
    gets a personal coupon at once. When that friend's first order is
    DELIVERED, the referrer gets a personal coupon too. Coupons are
    single-use, one customer only, and expire.
*/

const crypto = require('crypto');

const WELCOME_CODE = 'WELCOME';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(length) {
  let out = '';
  const bytes = crypto.randomBytes(length);

  for (let i = 0; i < length; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];

  return out;
}

function models() {
  return require('../models');
}

async function ensureReferralCode(userId) {
  const { User } = models();
  const user = await User.findById(userId).select('referralCode').lean();

  if (!user) return '';
  if (user.referralCode) return user.referralCode;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = randomCode(6);

    try {
      const saved = await User.findOneAndUpdate(
        { _id: userId, referralCode: { $exists: false } },
        { $set: { referralCode: code } },
        { new: true }
      ).select('referralCode').lean();

      if (saved) return saved.referralCode;

      const again = await User.findById(userId).select('referralCode').lean();

      return again && again.referralCode ? again.referralCode : '';
    } catch (err) {
      if (!(err && err.code === 11000)) throw err; // code clash: try another
    }
  }

  return '';
}

async function createPersonalCoupon({ userId, source, amount, minOrder, days = 60, description }) {
  const { Coupon } = models();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = 'MC' + randomCode(7);

    try {
      return await Coupon.create({
        code,
        description,
        discountType: 'FIXED',
        discountValue: amount,
        minOrderAmount: minOrder,
        startsAt: new Date(),
        expiresAt: new Date(Date.now() + days * 86400000),
        usageLimit: 1,
        perUserLimit: 1,
        isActive: true,
        allowedUser: userId,
        source
      });
    } catch (err) {
      if (!(err && err.code === 11000)) throw err;
    }
  }

  throw new Error('Could not create a coupon code.');
}

// Called right after sign-up. Never throws: sign-up must not fail because of it.
async function applyReferralAtSignup(newUser, code, settings) {
  try {
    if (!settings.referralEnabled || !code) return null;

    const { User } = models();
    const clean = String(code).trim().toUpperCase().slice(0, 12);

    if (!/^[A-Z0-9]{4,12}$/.test(clean)) return null;

    const referrer = await User.findOne({ referralCode: clean }).select('_id').lean();

    if (!referrer || String(referrer._id) === String(newUser._id)) return null;

    await User.updateOne(
      { _id: newUser._id, referredBy: { $exists: false } },
      { $set: { referredBy: referrer._id, referralRewarded: false } }
    );

    return await createPersonalCoupon({
      userId: newUser._id,
      source: 'REFERRAL_FRIEND',
      amount: settings.referralFriendAmount,
      minOrder: settings.referralMinOrder,
      description: `Welcome gift: Rs ${settings.referralFriendAmount} off your first order`
    });
  } catch (err) {
    console.warn('[Referral] signup:', err.message);
    return null;
  }
}

// Gives the referrer their coupon once the friend's first order is delivered.
async function rewardReferrers(deps = {}, settings = require('./settingsService').peek()) {
  const { User, Order } = deps.models || models();

  if (!settings.referralEnabled) return { rewarded: 0 };

  const pending = await User.find({ referredBy: { $exists: true }, referralRewarded: false })
    .select('_id referredBy')
    .limit(50)
    .lean();

  let rewarded = 0;

  for (const friend of pending) {
    const delivered = await Order.exists({ user: friend._id, orderStatus: 'Delivered' });

    if (!delivered) continue;

    const claimed = await User.updateOne(
      { _id: friend._id, referralRewarded: false },
      { $set: { referralRewarded: true } }
    );

    if (!claimed.modifiedCount) continue;

    await (deps.createCoupon || createPersonalCoupon)({
      userId: friend.referredBy,
      source: 'REFERRAL_REWARD',
      amount: settings.referralRewardAmount,
      minOrder: settings.referralMinOrder,
      description: `Thank you for referring a friend: Rs ${settings.referralRewardAmount} off`
    });

    rewarded += 1;
  }

  return { rewarded };
}

async function syncWelcomeCoupon(settings) {
  const { Coupon } = models();
  const fields = {
    description: `${settings.welcomePercent}% off your first order`,
    discountType: 'PERCENTAGE',
    discountValue: settings.welcomePercent,
    minOrderAmount: settings.welcomeMinOrder,
    maxDiscountAmount: settings.welcomeMaxDiscount > 0 ? settings.welcomeMaxDiscount : null,
    isActive: settings.welcomeEnabled === true,
    firstOrderOnly: true,
    source: 'WELCOME',
    perUserLimit: 1
  };

  const existing = await Coupon.findOne({ code: WELCOME_CODE }).select('_id source').lean();

  if (existing) {
    if (existing.source !== 'WELCOME') return; // the owner made their own coupon with this name

    await Coupon.updateOne({ _id: existing._id }, { $set: fields });
    return;
  }

  if (!settings.welcomeEnabled) return;

  await Coupon.create({
    code: WELCOME_CODE,
    ...fields,
    startsAt: new Date(),
    expiresAt: new Date(Date.now() + 5 * 365 * 86400000),
    usageLimit: 1000000
  });
}

let timer = null;

function startReferralSweeper() {
  if (timer) return;

  const run = async () => {
    try {
      const r = await rewardReferrers();

      if (r.rewarded) console.log('[Referral] rewards given:', r.rewarded);
    } catch (err) {
      console.warn('[Referral] failed:', err.message);
    }
  };

  setTimeout(run, 150 * 1000).unref();
  timer = setInterval(run, 10 * 60 * 1000);
  timer.unref();
}

module.exports = {
  WELCOME_CODE,
  ensureReferralCode,
  createPersonalCoupon,
  applyReferralAtSignup,
  rewardReferrers,
  syncWelcomeCoupon,
  startReferralSweeper
};
