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

function firstName(name) {
  return String(name || 'Ek friend').trim().split(/\s+/)[0].slice(0, 20);
}

// Phone notification to one customer. Never throws, never blocks.
function tell(userId, title, body) {
  try {
    require('./pushService')
      .notify({ kind: 'user', userId, title, body, url: '/frontend/profile.html' })
      .catch(() => {});
  } catch (_) { /* optional */ }
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

    const linked = await User.updateOne(
      { _id: newUser._id, referredBy: { $exists: false } },
      { $set: { referredBy: referrer._id, referralRewarded: false, referredAt: new Date() } }
    );

    if (!linked.modifiedCount) return null;

    const coupon = await createPersonalCoupon({
      userId: newUser._id,
      source: 'REFERRAL_FRIEND',
      amount: settings.referralFriendAmount,
      minOrder: settings.referralMinOrder,
      description: `Welcome gift: Rs ${settings.referralFriendAmount} off your first order`
    });

    await User.updateOne({ _id: newUser._id }, { $set: { referralFriendCode: coupon.code } });

    tell(referrer._id, 'Aapke code se naya friend juda!',
      `${firstName(newUser.fullName)} ne aapke referral code se sign up kiya. Unka pehla order deliver hote hi aapko Rs ${settings.referralRewardAmount} ka coupon milega.`);

    return coupon;
  } catch (err) {
    console.warn('[Referral] signup:', err.message);
    return null;
  }
}

// Gives the referrer their coupon once the friend's first order is delivered.
// `onlyUserId` limits the check to one friend (used right after a delivery).
async function rewardReferrers(deps = {}, settings = require('./settingsService').peek(), onlyUserId = null) {
  const { User, Order } = deps.models || models();

  if (!settings.referralEnabled) return { rewarded: 0 };

  const filter = { referredBy: { $exists: true }, referralRewarded: false };

  if (onlyUserId) filter._id = onlyUserId;

  const pending = await User.find(filter)
    .select('_id referredBy')
    .limit(50)
    .lean();

  let rewarded = 0;

  for (const friend of pending) {
    const delivered = await Order.exists({ user: friend._id, orderStatus: 'Delivered' });

    if (!delivered) continue;

    const claimed = await User.updateOne(
      { _id: friend._id, referralRewarded: false },
      { $set: { referralRewarded: true, referralRewardedAt: new Date() } }
    );

    if (!claimed.modifiedCount) continue;

    let coupon;

    try {
      coupon = await (deps.createCoupon || createPersonalCoupon)({
        userId: friend.referredBy,
        source: 'REFERRAL_REWARD',
        amount: settings.referralRewardAmount,
        minOrder: settings.referralMinOrder,
        description: `Thank you for referring a friend: Rs ${settings.referralRewardAmount} off`
      });
    } catch (err) {
      // Give the claim back so the next check tries again: no reward is ever lost.
      await User.updateOne({ _id: friend._id }, { $set: { referralRewarded: false }, $unset: { referralRewardedAt: 1 } });
      throw err;
    }

    if (coupon && coupon.code) {
      await User.updateOne({ _id: friend._id }, { $set: { referralRewardCode: coupon.code } });
    }

    if (!deps.models) {
      tell(friend.referredBy, 'Referral reward mil gaya!',
        `Aapke friend ka pehla order deliver ho gaya. Rs ${settings.referralRewardAmount} ka coupon ${coupon && coupon.code ? coupon.code : ''} aapki Profile me hai.`);
    }

    rewarded += 1;
  }

  return { rewarded };
}

// Right after an order is delivered: reward that customer's referrer at once.
async function rewardAfterDelivery(userId) {
  try {
    if (userId) await rewardReferrers({}, require('./settingsService').peek(), userId);
  } catch (err) {
    console.warn('[Referral] delivery reward:', err.message);
  }
}

/* =====================================================================
   HISTORY (read-only): what the customer sees in Profile and what the
   owner sees in Admin -> Referrals.
===================================================================== */

function maskName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);

  if (!parts.length) return 'Customer';

  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.` : parts[0];
}

function maskMobile(mobile) {
  const m = String(mobile || '');

  return m.length >= 10 ? `${m.slice(0, 2)}XXXXXX${m.slice(-2)}` : '';
}

// JOINED (signed up) -> ORDERED (placed an order) -> DELIVERED -> REWARDED
function statusOf(friend, counts) {
  if (friend.referralRewarded === true) return 'REWARDED';
  if (counts && counts.delivered > 0) return 'DELIVERED';
  if (counts && counts.placed > 0) return 'ORDERED';

  return 'JOINED';
}

async function orderCounts(userIds) {
  const { Order } = models();
  const out = new Map();

  if (!userIds.length) return out;

  const rows = await Order.aggregate([
    { $match: { user: { $in: userIds }, paymentStatus: { $nin: ['FAILED', 'CANCELLED'] } } },
    {
      $group: {
        _id: '$user',
        placed: { $sum: { $cond: [{ $ne: ['$orderStatus', 'Cancelled'] }, 1, 0] } },
        delivered: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Delivered'] }, 1, 0] } }
      }
    }
  ]);

  rows.forEach(r => out.set(String(r._id), { placed: r.placed, delivered: r.delivered }));

  return out;
}

async function couponInfo(codes) {
  const { Coupon } = models();
  const list = [...new Set(codes.filter(Boolean))];
  const out = new Map();

  if (!list.length) return out;

  const rows = await Coupon.find({ code: { $in: list } })
    .select('code discountValue usedCount expiresAt')
    .lean();

  rows.forEach(c => out.set(c.code, {
    code: c.code,
    amount: c.discountValue,
    used: (c.usedCount || 0) > 0,
    expired: new Date(c.expiresAt) < new Date()
  }));

  return out;
}

const FRIEND_FIELDS = 'fullName mobile createdAt referredBy referredAt referralRewarded referralRewardedAt referralRewardCode referralFriendCode';

async function overviewFor(userId) {
  const { User } = models();
  const me = await User.findById(userId).select('referralCode referredBy referredAt referralFriendCode').lean();

  if (!me) return null;

  const [referrer, friends] = await Promise.all([
    me.referredBy ? User.findById(me.referredBy).select('fullName').lean() : null,
    User.find({ referredBy: userId }).select(FRIEND_FIELDS).sort({ createdAt: -1 }).limit(200).lean()
  ]);

  const counts = await orderCounts(friends.map(f => f._id));
  const coupons = await couponInfo([me.referralFriendCode, ...friends.map(f => f.referralRewardCode)]);

  const rows = friends.map(f => ({
    name: maskName(f.fullName),
    mobile: maskMobile(f.mobile),
    joinedAt: f.referredAt || f.createdAt,
    status: statusOf(f, counts.get(String(f._id))),
    reward: f.referralRewardCode ? coupons.get(f.referralRewardCode) || { code: f.referralRewardCode } : null
  }));

  const earned = rows.reduce((sum, r) => sum + (r.reward && r.reward.amount ? r.reward.amount : 0), 0);

  return {
    referredBy: referrer
      ? { name: maskName(referrer.fullName), at: me.referredAt || null, gift: me.referralFriendCode ? coupons.get(me.referralFriendCode) || { code: me.referralFriendCode } : null }
      : null,
    stats: {
      joined: rows.length,
      ordered: rows.filter(r => r.status !== 'JOINED').length,
      rewarded: rows.filter(r => r.status === 'REWARDED').length,
      earned
    },
    friends: rows
  };
}

async function adminOverview({ search = '', limit = 300 } = {}) {
  const { User, Coupon } = models();
  const cap = Math.min(Math.max(Number(limit) || 300, 1), 1000);

  const [total, rewardedTotal, friends] = await Promise.all([
    User.countDocuments({ referredBy: { $exists: true } }),
    User.countDocuments({ referralRewarded: true }),
    User.find({ referredBy: { $exists: true } }).select(FRIEND_FIELDS).sort({ createdAt: -1 }).limit(cap).lean()
  ]);

  const referrerIds = [...new Set(friends.map(f => String(f.referredBy)))];
  const referrers = referrerIds.length
    ? await User.find({ _id: { $in: referrerIds } }).select('fullName mobile referralCode').lean()
    : [];
  const byId = new Map(referrers.map(r => [String(r._id), r]));

  const counts = await orderCounts(friends.map(f => f._id));
  const coupons = await couponInfo(friends.flatMap(f => [f.referralFriendCode, f.referralRewardCode]));

  let rows = friends.map(f => {
    const r = byId.get(String(f.referredBy)) || {};

    return {
      friendId: f._id,
      friend: { name: f.fullName, mobile: f.mobile },
      referrer: { name: r.fullName || 'Deleted customer', mobile: r.mobile || '', code: r.referralCode || '' },
      joinedAt: f.referredAt || f.createdAt,
      status: statusOf(f, counts.get(String(f._id))),
      friendGift: f.referralFriendCode ? coupons.get(f.referralFriendCode) || { code: f.referralFriendCode } : null,
      reward: f.referralRewardCode ? coupons.get(f.referralRewardCode) || { code: f.referralRewardCode } : null
    };
  });

  const q = String(search || '').trim().toLowerCase().slice(0, 40);

  if (q) {
    rows = rows.filter(r => [r.friend.name, r.friend.mobile, r.referrer.name, r.referrer.mobile, r.referrer.code]
      .some(v => String(v || '').toLowerCase().includes(q)));
  }

  const top = new Map();

  friends.forEach(f => {
    const key = String(f.referredBy);
    const t = top.get(key) || { joined: 0, rewarded: 0 };

    t.joined += 1;
    if (f.referralRewarded === true) t.rewarded += 1;
    top.set(key, t);
  });

  const topReferrers = [...top.entries()]
    .map(([id, t]) => ({ name: (byId.get(id) || {}).fullName || 'Deleted customer', mobile: (byId.get(id) || {}).mobile || '', ...t }))
    .sort((a, b) => b.joined - a.joined)
    .slice(0, 5);

  const [given, used] = await Promise.all([
    Coupon.countDocuments({ source: { $in: ['REFERRAL_FRIEND', 'REFERRAL_REWARD'] } }),
    Coupon.countDocuments({ source: { $in: ['REFERRAL_FRIEND', 'REFERRAL_REWARD'] }, usedCount: { $gt: 0 } })
  ]);

  return {
    stats: {
      referred: total,
      rewarded: rewardedTotal,
      waiting: total - rewardedTotal,
      couponsGiven: given,
      couponsUsed: used
    },
    topReferrers,
    rows
  };
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
  rewardAfterDelivery,
  overviewFor,
  adminOverview,
  maskName,
  maskMobile,
  statusOf,
  syncWelcomeCoupon,
  startReferralSweeper
};
