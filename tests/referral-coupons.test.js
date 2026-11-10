'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const root = path.join(__dirname, '..', 'backend');
const stub = (rel, exports) => {
  const file = require.resolve(path.join(root, rel));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
};

let coupon;
let ordersBefore = 0;
const created = [];

const chain = v => ({ lean: async () => v, select() { return this; } });

stub('models/index.js', {
  Coupon: {
    findOne: () => chain(coupon),
    create: async d => { created.push(d); return d; }
  },
  Order: { countDocuments: async () => ordersBefore, exists: async () => false },
  CouponUserUsage: { findOne: () => chain(null) },
  User: {}
});

const { validateCoupon } = require(path.join(root, 'services/couponService.js'));

const base = () => ({
  _id: 'c1', code: 'WELCOME', isActive: true, expiresAt: new Date(Date.now() + 1e9), usedCount: 0,
  usageLimit: 100, minOrderAmount: 0, perUserLimit: 1, discountType: 'PERCENTAGE', discountValue: 10,
  maxDiscountAmount: 100, firstOrderOnly: false, allowedUser: null
});

test('first-order coupon works for a new customer only', async () => {
  coupon = { ...base(), firstOrderOnly: true };
  ordersBefore = 0;
  const r = await validateCoupon({ code: 'WELCOME', subtotal: 500, userId: 'u1' });
  assert.strictEqual(r.discount, 50);

  ordersBefore = 1;
  await assert.rejects(validateCoupon({ code: 'WELCOME', subtotal: 500, userId: 'u1' }), /first order/);
  await assert.rejects(validateCoupon({ code: 'WELCOME', subtotal: 500 }), /login/);
});

test('personal coupon works only for its owner', async () => {
  coupon = { ...base(), code: 'MCABC1234', discountType: 'FIXED', discountValue: 50, allowedUser: 'u1' };
  ordersBefore = 0;
  const r = await validateCoupon({ code: 'MCABC1234', subtotal: 400, userId: 'u1' });
  assert.strictEqual(r.discount, 50);
  await assert.rejects(validateCoupon({ code: 'MCABC1234', subtotal: 400, userId: 'u2' }), /not available/);
  await assert.rejects(validateCoupon({ code: 'MCABC1234', subtotal: 400 }), /not available/);
});

test('referrer reward is given once, only after delivery', async () => {
  const { rewardReferrers } = require(path.join(root, 'services/referralService.js'));
  const given = [];
  let delivered = false;
  const friends = [{ _id: 'f1', referredBy: 'r1' }];
  let flag = false;

  const deps = {
    models: {
      User: {
        find: () => ({ select: () => ({ limit: () => ({ lean: async () => (flag ? [] : friends) }) }) }),
        updateOne: async () => { if (flag) return { modifiedCount: 0 }; flag = true; return { modifiedCount: 1 }; }
      },
      Order: { exists: async () => delivered }
    },
    createCoupon: async c => { given.push(c); }
  };
  const settings = { referralEnabled: true, referralRewardAmount: 50, referralMinOrder: 299 };

  assert.deepStrictEqual(await rewardReferrers(deps, settings), { rewarded: 0 });
  delivered = true;
  assert.deepStrictEqual(await rewardReferrers(deps, settings), { rewarded: 1 });
  assert.deepStrictEqual(await rewardReferrers(deps, settings), { rewarded: 0 });
  assert.strictEqual(given.length, 1);
  assert.strictEqual(given[0].userId, 'r1');
  assert.strictEqual(given[0].source, 'REFERRAL_REWARD');
});

test('WELCOME coupon is created from the settings', async () => {
  const { syncWelcomeCoupon } = require(path.join(root, 'services/referralService.js'));
  coupon = null;
  created.length = 0;
  await syncWelcomeCoupon({ welcomeEnabled: true, welcomePercent: 15, welcomeMaxDiscount: 120, welcomeMinOrder: 299 });
  assert.strictEqual(created[0].code, 'WELCOME');
  assert.strictEqual(created[0].firstOrderOnly, true);
  assert.strictEqual(created[0].discountValue, 15);

  created.length = 0;
  await syncWelcomeCoupon({ welcomeEnabled: false, welcomePercent: 15 });
  assert.strictEqual(created.length, 0);
});
