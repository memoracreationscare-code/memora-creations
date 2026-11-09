'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const Module = require('node:module');

// mongoose may not be installed where tests run: provide a tiny stand-in.
const mongoose = {};
const realLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'mongoose') return mongoose;
  return realLoad.call(this, request, ...rest);
};

const root = path.join(__dirname, '..', 'backend');
const stub = (rel, exports) => {
  const file = require.resolve(path.join(root, rel));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
};

const calls = [];
let shipment = null;
let gatewayStatus = 'PAID';
let refundShouldFail = false;
let existingRefunds = [];
let currentOrder;

const makeOrder = extra => {
  const o = {
    _id: 'o1', orderId: 'MC-1', orderStatus: 'Order Placed', paymentMethod: 'CASHFREE',
    paymentStatus: 'SUCCESS', cashfreeOrderId: 'cf1', grandTotal: 500, statusHistory: [],
    couponUsageReserved: false, markModified() {}, session() { return this; },
    async save() { calls.push('save'); }, ...extra
  };
  o.statusHistory.push = function (x) { Array.prototype.push.call(this, x); };
  return o;
};

stub('models/index.js', {
  Order: { findById: () => currentOrder },
  ShipmentTracking: { findOne: () => ({ lean: async () => shipment }) }
});
stub('models/CashfreeRefundAttempt.js', {
  init: async () => {}, create: async () => calls.push('attempt'),
  updateOne: async (_f, u) => { calls.push('attempt:' + u.$set.state); }
});
stub('services/orderService.js', { releaseStock: async () => calls.push('stock') });
stub('services/couponUsageService.js', { releaseCoupon: async () => calls.push('coupon') });
stub('services/cashfreeService.js', {
  fetchCashfreeOrder: async () => ({ order_id: 'cf1', order_status: gatewayStatus, order_amount: 500, order_currency: 'INR' }),
  isCashfreePaymentSuccessful: g => g.order_status === 'PAID',
  createCashfreeRefund: async () => { if (refundShouldFail) throw new Error('boom'); calls.push('refund'); },
  terminateCashfreeOrder: async () => calls.push('terminate')
});
stub('services/cashfreeRefundService.js', { getCashfreeRefunds: async () => existingRefunds });
stub('services/shiprocketService.js', {
  cancelShiprocketOrder: async () => { if (shipment && shipment.fail) throw new Error('sr down'); calls.push('shiprocket'); }
});

mongoose.startSession = async () => ({ withTransaction: async fn => fn(), endSession: async () => {} });

const { autoCancelOrder } = require(path.join(root, 'services/orderCancellation.js'));

const reset = () => {
  calls.length = 0; shipment = null; gatewayStatus = 'PAID';
  refundShouldFail = false; existingRefunds = [];
  delete process.env.AUTO_REFUND_ENABLED;
};

test('COD order is cancelled, stock released, no refund', async () => {
  reset();
  currentOrder = makeOrder({ paymentMethod: 'COD', paymentStatus: 'COD_PENDING' });
  const o = await autoCancelOrder(currentOrder);
  assert.strictEqual(o.orderStatus, 'Cancelled');
  assert.strictEqual(o.paymentStatus, 'CANCELLED');
  assert.ok(calls.includes('stock'));
  assert.ok(!calls.includes('refund'));
});

test('paid Cashfree order is refunded when AUTO_REFUND_ENABLED', async () => {
  reset(); process.env.AUTO_REFUND_ENABLED = 'true';
  currentOrder = makeOrder();
  const o = await autoCancelOrder(currentOrder);
  assert.strictEqual(o.orderStatus, 'Cancelled');
  assert.strictEqual(o.autoCancel.refundStatus, 'SUBMITTED');
  assert.ok(calls.includes('refund'));
});

test('paid order falls back when refunds are not enabled', async () => {
  reset();
  currentOrder = makeOrder();
  await assert.rejects(autoCancelOrder(currentOrder), /AUTO_REFUND_DISABLED/);
  assert.ok(!calls.includes('stock'));
});

test('refund failure still cancels but is flagged', async () => {
  reset(); process.env.AUTO_REFUND_ENABLED = 'true'; refundShouldFail = true;
  currentOrder = makeOrder();
  const o = await autoCancelOrder(currentOrder);
  assert.strictEqual(o.orderStatus, 'Cancelled');
  assert.strictEqual(o.autoCancel.refundStatus, 'FAILED');
});

test('existing Cashfree refund blocks automatic refund', async () => {
  reset(); process.env.AUTO_REFUND_ENABLED = 'true'; existingRefunds = [{}];
  currentOrder = makeOrder();
  await assert.rejects(autoCancelOrder(currentOrder), /refund already exists/);
  assert.ok(!calls.includes('stock'));
});

test('unpaid order closes the payment link, no refund', async () => {
  reset(); gatewayStatus = 'ACTIVE';
  currentOrder = makeOrder({ paymentStatus: 'PENDING' });
  const o = await autoCancelOrder(currentOrder);
  assert.ok(calls.includes('terminate'));
  assert.ok(!calls.includes('refund'));
  assert.strictEqual(o.paymentStatus, 'CANCELLED');
});

test('unpaid order that was just paid is not cancelled', async () => {
  reset(); gatewayStatus = 'PAID';
  currentOrder = makeOrder({ paymentStatus: 'PENDING' });
  await assert.rejects(autoCancelOrder(currentOrder), /being confirmed/);
  assert.ok(!calls.includes('stock'));
});

test('booked Shiprocket order is cancelled; failure is flagged', async () => {
  reset();
  shipment = { shiprocketOrderId: '123' };
  currentOrder = makeOrder({ paymentMethod: 'COD', paymentStatus: 'COD_PENDING' });
  let o = await autoCancelOrder(currentOrder);
  assert.strictEqual(o.autoCancel.shiprocket, 'CANCELLED');

  reset();
  shipment = { shiprocketOrderId: '123', fail: true };
  currentOrder = makeOrder({ paymentMethod: 'COD', paymentStatus: 'COD_PENDING' });
  o = await autoCancelOrder(currentOrder);
  assert.strictEqual(o.orderStatus, 'Cancelled');
  assert.strictEqual(o.autoCancel.shiprocket, 'FAILED');
});

test('shipped or already cancelled orders are refused', async () => {
  reset();
  currentOrder = makeOrder({ orderStatus: 'Shipped' });
  await assert.rejects(autoCancelOrder(currentOrder), /can no longer/);
  currentOrder = makeOrder({ orderStatus: 'Cancelled' });
  await assert.rejects(autoCancelOrder(currentOrder), /already cancelled/);
});
