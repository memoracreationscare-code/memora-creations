'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// mongoose is only needed for ObjectId.isValid here; stub it when it is not installed.
try { require.resolve('mongoose'); } catch (_) {
  const file = path.join(__dirname, 'mongoose-stub.js');
  require.cache[file] = { id: file, filename: file, loaded: true, exports: { Types: { ObjectId: { isValid: v => /^[a-f0-9]{24}$/i.test(String(v)) } } } };
  const Module = require('node:module');
  const orig = Module._resolveFilename;
  Module._resolveFilename = function (req, ...a) { return req === 'mongoose' ? file : orig.call(this, req, ...a); };
}

const { computeBundleDiscount } = require('../backend/services/bundleService');
const { clean } = require('../backend/controllers/adminBundlesController');

const item = (id, quantity) => ({ product: { _id: id }, quantity });
const bundle = (products, discountAmount, extra = {}) => ({ name: 'B', products, discountAmount, isActive: true, ...extra });

test('no discount unless every product of the bundle is in the cart', () => {
  const r = computeBundleDiscount([item('a', 2)], [bundle(['a', 'b'], 100)], 1000);
  assert.strictEqual(r.discount, 0);
  assert.deepStrictEqual(r.names, []);
});

test('one complete set gets the discount, extra units do not', () => {
  const r = computeBundleDiscount([item('a', 3), item('b', 1)], [bundle(['a', 'b'], 100)], 1000);
  assert.strictEqual(r.discount, 100);
});

test('two sets double the discount (smallest quantity decides)', () => {
  const r = computeBundleDiscount([item('a', 2), item('b', 5)], [bundle(['a', 'b'], 100)], 5000);
  assert.strictEqual(r.discount, 200);
  assert.strictEqual(r.applied[0].sets, 2);
});

test('the same product in the cart as two lines (variants) is added together', () => {
  const r = computeBundleDiscount([item('a', 1), item('a', 1), item('b', 2)], [bundle(['a', 'b'], 50)], 5000);
  assert.strictEqual(r.discount, 100);
});

test('a unit is used by one bundle only; the bigger saving goes first', () => {
  const r = computeBundleDiscount(
    [item('a', 1), item('b', 1), item('c', 1)],
    [bundle(['a', 'b'], 50, { name: 'small' }), bundle(['a', 'c'], 80, { name: 'big' })],
    5000
  );
  assert.strictEqual(r.discount, 80);
  assert.deepStrictEqual(r.names, ['big']);
});

test('inactive bundles and bad data are ignored', () => {
  const r = computeBundleDiscount(
    [item('a', 1), item('b', 1)],
    [bundle(['a', 'b'], 100, { isActive: false }), bundle(['a'], 100), bundle(['a', 'b'], 0), null],
    5000
  );
  assert.strictEqual(r.discount, 0);
});

test('discount never exceeds the subtotal and is rounded to paise', () => {
  assert.strictEqual(computeBundleDiscount([item('a', 1), item('b', 1)], [bundle(['a', 'b'], 500)], 300).discount, 300);
  assert.strictEqual(computeBundleDiscount([item('a', 3), item('b', 3)], [bundle(['a', 'b'], 33.33)], 9999).discount, 99.99);
});

test('products can be matched by ObjectId-like objects and productId fallback', () => {
  const oid = { toString: () => 'x1' };
  const r = computeBundleDiscount([{ product: { _id: oid }, quantity: 1 }, { productId: 'y2', quantity: 1 }], [bundle([oid, 'y2'], 40)], 900);
  assert.strictEqual(r.discount, 40);
});

test('admin input is validated', () => {
  const ok = { name: ' Combo ', productIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'], discountAmount: '99.5' };
  const d = clean(ok);
  assert.strictEqual(d.name, 'Combo');
  assert.strictEqual(d.discountAmount, 99.5);
  assert.throws(() => clean({ ...ok, productIds: ['507f1f77bcf86cd799439011'] }));
  assert.throws(() => clean({ ...ok, productIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439011'] }));
  assert.throws(() => clean({ ...ok, productIds: ['nope', 'bad'] }));
  assert.throws(() => clean({ ...ok, discountAmount: 0 }));
  assert.throws(() => clean({ ...ok, name: '  ' }));
});

test('every price path subtracts the bundle discount', () => {
  const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  assert.match(read('backend/services/orderService.js'), /appliedCouponDiscount -\s+bundle\.discount/);
  assert.match(read('backend/services/orderService.js'), /bundleDiscount: bundle\.discount/);
  assert.match(read('backend/services/couponPricingService.js'), /couponDiscount -\s+bundle\.discount/);
  assert.match(read('backend/routes/couponRoutes.js'), /couponDiscount -\s+bundle\.discount/);
  assert.match(read('backend/controllers/cartController.js'), /subtotal - bundle\.discount \+ delivery/);
  assert.match(read('backend/controllers/paymentController.js'), /t\.grandTotal - bundle\.discount/);
  assert.match(read('backend/models/Order.js'), /bundleDiscount:/);
});

test('bundle admin routes are owner-only (staff guard blocks them by default)', () => {
  const { ALLOWED } = require('../backend/middleware/staffGuard');
  assert.ok(!ALLOWED.some(([, re]) => re.test('/bundles')));
});
