'use strict';

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const Module = require('node:module');

process.env.CASHFREE_CLIENT_SECRET = 'whsec_test';

let order = null;
let gateway = { order_id: 'cf1', order_status: 'PAID', order_amount: 500, order_currency: 'INR' };
let updates = 0;

const stubs = {
  '../models': {
    Order: {
      findOne: async () => order,
      findById: async () => order,
      findOneAndUpdate: async (filter, upd) => {
        if (order.paymentStatus !== filter.paymentStatus || order.orderStatus === 'Cancelled' || order.stockReserved !== true) return null;
        updates += 1;
        order = { ...order, paymentStatus: 'SUCCESS', ...(upd.$set || {}) };
        return order;
      }
    }
  },
  '../services/cashfreeService': {
    fetchCashfreeOrder: async () => gateway,
    isCashfreePaymentSuccessful: (g, amount) => g.order_status === 'PAID' && Number(g.order_amount) === Number(amount) && g.order_currency === 'INR'
  },
  '../utils/codAdvance': { onlineAmount: o => o.grandTotal }
};
const orig = Module._load;
Module._load = function (request, ...rest) {
  if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
  return orig.call(this, request, ...rest);
};
test.after(() => { Module._load = orig; });

const { cashfreeWebhook } = require('../backend/controllers/cashfreeWebhookController');

const fresh = (over = {}) => ({
  _id: 'o1', orderId: 'MC1', paymentMethod: 'CASHFREE', cashfreeOrderId: 'cf1', grandTotal: 500,
  paymentStatus: 'PENDING', orderStatus: 'Order Placed', stockReserved: true, ...over
});

const body = (over = {}) => JSON.stringify({
  type: 'PAYMENT_SUCCESS_WEBHOOK',
  data: { order: { order_id: 'cf1' }, payment: { payment_status: 'SUCCESS', cf_payment_id: 99 } },
  ...over
});

function send(raw, { sign = true, secret = 'whsec_test' } = {}) {
  const ts = String(Date.now());
  const buf = Buffer.from(raw);
  const sig = crypto.createHmac('sha256', secret).update(ts).update(buf).digest('base64');
  const req = { body: buf, headers: sign ? { 'x-webhook-signature': sig, 'x-webhook-timestamp': ts } : {} };

  return new Promise(resolve => {
    const res = { status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, b }); } };
    cashfreeWebhook(req, res);
  });
}

test('unsigned or wrongly signed webhook is rejected and changes nothing', async () => {
  order = fresh();
  assert.strictEqual((await send(body(), { sign: false })).code, 401);
  assert.strictEqual((await send(body(), { secret: 'attacker' })).code, 401);
  assert.strictEqual(order.paymentStatus, 'PENDING');
});

test('good webhook marks the order paid exactly once; a repeat is harmless', async () => {
  order = fresh(); updates = 0;
  assert.strictEqual((await send(body())).code, 200);
  assert.strictEqual(order.paymentStatus, 'SUCCESS');
  assert.strictEqual(order.cashfreePaymentId, '99');
  assert.strictEqual((await send(body())).code, 200);
  assert.strictEqual(updates, 1);
});

test('Cashfree says not paid, or amount differs: order is NOT marked paid', async () => {
  order = fresh();
  gateway = { order_id: 'cf1', order_status: 'ACTIVE', order_amount: 500, order_currency: 'INR' };
  assert.strictEqual((await send(body())).code, 503); // Cashfree will retry
  gateway = { order_id: 'cf1', order_status: 'PAID', order_amount: 1, order_currency: 'INR' };
  assert.strictEqual((await send(body())).code, 409);
  assert.strictEqual(order.paymentStatus, 'PENDING');
  gateway = { order_id: 'cf1', order_status: 'PAID', order_amount: 500, order_currency: 'INR' };
});

test('payment for an unknown order asks Cashfree to retry (503), never lost silently', async () => {
  order = null;
  assert.strictEqual((await send(body())).code, 503);
});

test('late payment on a cancelled order is NOT confirmed and is flagged (409)', async () => {
  order = fresh({ orderStatus: 'Cancelled', stockReserved: false, paymentStatus: 'CANCELLED' });
  assert.strictEqual((await send(body())).code, 409);
  assert.strictEqual(order.paymentStatus, 'CANCELLED');
});

test('failed-payment events and junk are acknowledged without touching orders', async () => {
  order = fresh();
  assert.strictEqual((await send(body({ type: 'PAYMENT_FAILED_WEBHOOK' }))).code, 200);
  assert.strictEqual(order.paymentStatus, 'PENDING');
  assert.strictEqual((await send('not json')).code, 400);
});
