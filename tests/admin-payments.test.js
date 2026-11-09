'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const Module = require('node:module');

const mongoose = { isValidObjectId: () => true };
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

const log = [];
let order;
let gatewayPaid = true;
let existing = [];

stub('models/index.js', { Order: { findById: async () => order, updateOne: async () => {} } });
stub('services/orderCancellation.js', {
  cancelInDatabase: async o => { log.push('cancel'); o.orderStatus = 'Cancelled'; return o; },
  cancelShiprocketIfBooked: async () => { log.push('shiprocket'); return ''; }
});
stub('services/cashfreeRefundService.js', { getCashfreeRefunds: async () => existing });
stub('services/cashfreeService.js', {
  fetchCashfreeOrder: async () => ({ order_id: 'cf1', order_status: gatewayPaid ? 'PAID' : 'ACTIVE', order_amount: 100 }),
  fetchCashfreePayments: async () => [],
  isCashfreePaymentSuccessful: g => g.order_status === 'PAID',
  createCashfreeRefund: async a => { log.push('refund:' + a.amount + ':' + a.refundId); }
});

const { refundPayment } = require(path.join(root, 'controllers/adminPaymentController.js'));

function call(body) {
  return new Promise((resolve, reject) => {
    const res = { status() { return this; }, json(x) { resolve(x); return this; } };
    refundPayment({ params: { id: 'o1' }, body }, res, reject);
  });
}

const mk = extra => ({
  _id: 'o1', orderId: 'MC-1', paymentMethod: 'CASHFREE', paymentStatus: 'SUCCESS',
  cashfreeOrderId: 'cf1', grandTotal: 100, orderStatus: 'Order Placed', statusHistory: [],
  async save() {}, markModified() {}, ...extra
});

const reset = () => { log.length = 0; gatewayPaid = true; existing = []; order = mk(); };

test('full refund of an unshipped order cancels it', async () => {
  reset();
  await call({ confirmed: true });
  assert.ok(log.some(x => x.startsWith('refund:100:MCAD')));
  assert.ok(log.includes('cancel'));
  assert.strictEqual(order.refund.status, 'PROCESSING');
  assert.strictEqual(order.refund.amount, 100);
});

test('partial refund does not cancel the order', async () => {
  reset();
  await call({ confirmed: true, amount: 40 });
  assert.ok(log.some(x => x.startsWith('refund:40:')));
  assert.ok(!log.includes('cancel'));
  assert.strictEqual(order.orderStatus, 'Order Placed');
});

test('amount above what is left is refused', async () => {
  reset();
  existing = [{ refund_status: 'SUCCESS', refund_amount: 70 }];
  await assert.rejects(call({ confirmed: true, amount: 50 }), /between/);
  assert.strictEqual(log.length, 0);
});

test('needs confirmation, a paid order and a verified payment', async () => {
  reset();
  await assert.rejects(call({}), /confirm/);
  gatewayPaid = false;
  await assert.rejects(call({ confirmed: true }), /does not confirm/);
  reset(); order.paymentStatus = 'PENDING';
  await assert.rejects(call({ confirmed: true }), /Only paid/);
  assert.strictEqual(log.length, 0);
});

test('same click twice gives the same refund id', async () => {
  reset(); await call({ confirmed: true, amount: 10 });
  const first = log[0];
  reset(); await call({ confirmed: true, amount: 10 });
  assert.strictEqual(log[0], first);
});
