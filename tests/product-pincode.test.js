'use strict';

const test = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');

const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'express') return { Router: () => ({ use() {}, get() {}, post() {} }) };
  if (request === 'express-rate-limit') return () => (_q, _s, next) => next();
  if (request === '../middleware/auth') return { requireUser: (_q, _s, n) => n() };
  if (request === '../services/deliveryPincodeService') return { checkDeliveryPincode: async () => ({}) };
  return origLoad.call(this, request, ...rest);
};
const { productCheck } = require('../backend/routes/deliveryRoutes');
Module._load = origLoad;

const mkRes = () => ({ code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } });
const ID = 'a'.repeat(24);

test('rejects a bad PIN or product id', async () => {
  let r = await productCheck({ body: { pincode: '123', productId: ID } }, mkRes(), async () => ({}), new Map());
  assert.strictEqual(r.code, 400);
  r = await productCheck({ body: { pincode: '274305', productId: 'x' } }, mkRes(), async () => ({}), new Map());
  assert.strictEqual(r.code, 400);
});

test('returns delivery + COD info and caches the answer', async () => {
  let calls = 0;
  const check = async ({ paymentMethod }) => {
    calls++;
    return { success: true, pincode: '274305', available: true, estimatedDeliveryDays: 4, estimatedDeliveryDate: null,
      ...(paymentMethod === 'COD' ? { available: false } : {}) };
  };
  const cache = new Map();
  const req = { body: { pincode: '274305', productId: ID } };
  const r = await productCheck(req, mkRes(), check, cache);
  assert.strictEqual(r.code, 200);
  assert.strictEqual(r.body.available, true);
  assert.strictEqual(r.body.codAvailable, false);
  assert.strictEqual(r.body.estimatedDeliveryDays, 4);
  await productCheck(req, mkRes(), check, cache);
  assert.strictEqual(calls, 2); // second request served from cache
});

test('Shiprocket failure gives a friendly 503, unknown product 409', async () => {
  let r = await productCheck({ body: { pincode: '274305', productId: ID } }, mkRes(),
    async () => ({ success: false, reason: 'DELIVERY_CHECK_TEMPORARILY_UNAVAILABLE' }), new Map());
  assert.strictEqual(r.code, 503);
  r = await productCheck({ body: { pincode: '274305', productId: ID } }, mkRes(),
    async () => ({ success: false, reason: 'PRODUCT_UNAVAILABLE', message: 'x' }), new Map());
  assert.strictEqual(r.code, 409);
});
