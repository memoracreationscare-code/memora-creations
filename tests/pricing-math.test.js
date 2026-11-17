'use strict';

/* Randomised check of the money maths: the server's totals()/validateCoupon()
   must always agree with a plain, independent calculation. */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const root = path.join(__dirname, '..', 'backend');
const stub = (rel, exports) => {
  const file = require.resolve(path.join(root, rel));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
};

let coupon;
const chain = v => ({ lean: async () => v, select() { return this; } });

stub('models/index.js', {
  Coupon: { findOne: () => chain(coupon) },
  Order: { countDocuments: async () => 1, exists: async () => false },
  CouponUserUsage: { findOne: () => chain(null) },
  User: {}
});

let settings = { freeDeliveryAbove: 999, deliveryCharge: 100 };
stub('services/settingsService.js', { peek: () => settings, get: async () => settings });

/* mongoose is not installed in every sandbox; the maths never touches it */
const Module = require('node:module');
const realLoad = Module._load;
const fake = new Proxy(function () {}, { get: (_t, k) => (k === 'Schema' ? function () {} : fake), apply: () => fake, construct: () => fake });
Module._load = function (req, ...a) {
  if (req === 'mongoose') return fake;
  return realLoad.call(this, req, ...a);
};

let order;
try {
  order = require(path.join(root, 'services/orderService.js'));
} catch (e) {
  order = null;
  console.log('orderService load error:', e.message.split('\n')[0]);
}
Module._load = realLoad;

const { validateCoupon } = require(path.join(root, 'services/couponService.js'));

const rnd = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const paise = n => Math.round(n * 100);

test('orderService loads (so totals() can be checked)', () => {
  assert.ok(order && typeof order.totals === 'function', 'orderService could not be loaded in this sandbox');
});

test('totals(): 5000 random carts match an independent calculation', { skip: !order }, () => {
  for (let i = 0; i < 5000; i++) {
    settings = { freeDeliveryAbove: rnd(0, 3000), deliveryCharge: rnd(0, 200) };
    const items = Array.from({ length: rnd(1, 6) }, () => {
      const selling = rnd(1, 5000) + [0, 0.5, 0.99, 0.25][rnd(0, 3)];
      const original = Math.random() < 0.7 ? selling + rnd(0, 2000) : undefined;
      return { quantity: rnd(1, 9), product: { sellingPrice: selling, originalPrice: original } };
    });

    const r = order.totals(items);

    let sub = 0, orig = 0;
    for (const it of items) {
      sub += paise(it.product.sellingPrice) * it.quantity;
      orig += paise(it.product.originalPrice ?? it.product.sellingPrice) * it.quantity;
    }
    const delivery = sub / 100 >= settings.freeDeliveryAbove ? 0 : settings.deliveryCharge;

    assert.equal(paise(r.subtotal), sub, 'subtotal');
    assert.equal(paise(r.deliveryCharge), paise(delivery), 'delivery');
    assert.equal(paise(r.grandTotal), sub + paise(delivery), 'grand total');
    assert.equal(paise(r.discount), Math.max(0, orig - sub), 'saved amount');
  }
});

test('delivery is free exactly at the limit and charged one rupee below it', { skip: !order }, () => {
  settings = { freeDeliveryAbove: 999, deliveryCharge: 80 };
  const cart = p => [{ quantity: 1, product: { sellingPrice: p, originalPrice: p } }];
  assert.equal(order.totals(cart(999)).deliveryCharge, 0);
  assert.equal(order.totals(cart(998)).deliveryCharge, 80);
  assert.equal(order.totals(cart(998)).grandTotal, 1078);
});

test('validateCoupon(): 3000 random coupons never give a wrong discount', async () => {
  for (let i = 0; i < 3000; i++) {
    const amount = rnd(1, 20000) + [0, 0.5, 0.33][rnd(0, 2)];
    const type = Math.random() < 0.5 ? 'PERCENTAGE' : 'FIXED';
    const value = type === 'PERCENTAGE' ? rnd(1, 100) : rnd(1, 3000);
    const cap = Math.random() < 0.5 ? rnd(10, 1500) : null;
    coupon = {
      _id: 'c', code: 'SAVE10', isActive: true, expiresAt: new Date(Date.now() + 1e9), usedCount: 0,
      usageLimit: 100, minOrderAmount: 0, perUserLimit: 5, discountType: type, discountValue: value,
      maxDiscountAmount: cap, firstOrderOnly: false, allowedUser: null
    };

    const r = await validateCoupon({ code: 'SAVE10', subtotal: amount, userId: 'u' });

    let expect = type === 'PERCENTAGE' ? (amount * value) / 100 : value;
    if (cap !== null) expect = Math.min(expect, cap);
    expect = Math.min(expect, amount);

    assert.ok(Math.abs(r.discount - expect) <= 0.0051, `discount ${r.discount} vs ${expect}`);
    assert.ok(r.discount >= 0 && r.discount <= amount, 'never negative, never above the cart');
    assert.ok(Math.abs(r.discountedSubtotal - (amount - r.discount)) <= 0.0051, 'amount after coupon');
  }
});

test('coupon below the minimum order amount is refused', async () => {
  coupon = {
    _id: 'c', code: 'SAVE10', isActive: true, expiresAt: new Date(Date.now() + 1e9), usedCount: 0,
    usageLimit: 100, minOrderAmount: 500, perUserLimit: 5, discountType: 'FIXED', discountValue: 50,
    maxDiscountAmount: null, firstOrderOnly: false, allowedUser: null
  };
  await assert.rejects(() => validateCoupon({ code: 'SAVE10', subtotal: 499.99, userId: 'u' }), /Minimum order/);
  const ok = await validateCoupon({ code: 'SAVE10', subtotal: 500, userId: 'u' });
  assert.equal(ok.discount, 50);
});

test('COD advance: advance + balance always equals the total (2000 random totals)', () => {
  const { splitAdvance } = require(path.join(root, 'utils/codAdvance.js'));
  for (let i = 0; i < 2000; i++) {
    const total = rnd(2, 30000) + [0, 0.5, 0.99, 0.01][rnd(0, 3)];
    const pct = rnd(5, 90);
    const r = splitAdvance(total, pct);
    assert.ok(r, 'split for ' + total);
    assert.equal(Math.round((r.advanceAmount + r.balanceAmount) * 100), Math.round(total * 100));
    assert.ok(r.advanceAmount >= 1 && r.balanceAmount >= 1);
  }
});

test('admin dashboard counts real orders and uses India midnight for "today"', () => {
  const src = require('node:fs').readFileSync(path.join(root, 'controllers/adminController.js'), 'utf8');
  assert.match(src, /\$nin: \['PENDING', 'FAILED'\]/);
  assert.match(src, /5\.5 \* 60 \* 60 \* 1000/);
  assert.doesNotMatch(src, /start\.setHours\(0, 0, 0, 0\)/);
});
