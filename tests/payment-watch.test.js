'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const { scan } = require('../backend/services/paymentWatch');

// Tiny fake Order: answers each query by the payment state it asks for.
const orders = [
  { orderId: 'A1', paymentMethod: 'CASHFREE', paymentStatus: 'SUCCESS', orderStatus: 'Cancelled' },
  { orderId: 'A2', paymentMethod: 'CASHFREE', paymentStatus: 'SUCCESS', orderStatus: 'Cancelled', autoCancel: { refundStatus: 'SUBMITTED' } },
  { orderId: 'A3', paymentMethod: 'CASHFREE', paymentStatus: 'SUCCESS', orderStatus: 'Cancelled', refund: { status: 'REFUNDED' } },
  { orderId: 'B1', paymentMethod: 'CASHFREE', paymentStatus: 'SUCCESS', orderStatus: 'Order Placed', stockReserved: false },
  { orderId: 'C1', paymentMethod: 'CASHFREE', paymentStatus: 'PENDING', orderStatus: 'Order Placed', createdAt: new Date(Date.now() - 3 * 3600000) },
  { orderId: 'D1', paymentMethod: 'CASHFREE', paymentStatus: 'CANCELLED', orderStatus: 'Cancelled', cashfreeOrderId: 'cf_d1' },
  { orderId: 'D2', paymentMethod: 'CASHFREE', paymentStatus: 'FAILED', orderStatus: 'Cancelled', cashfreeOrderId: 'cf_d2' }
];

const Order = {
  find(q) {
    let rows = orders;
    if (q.paymentStatus === 'SUCCESS' && q.orderStatus === 'Cancelled') rows = orders.filter(o => o.paymentStatus === 'SUCCESS' && o.orderStatus === 'Cancelled');
    else if (q.paymentStatus === 'SUCCESS') rows = orders.filter(o => o.paymentStatus === 'SUCCESS' && o.orderStatus !== 'Cancelled' && o.stockReserved !== true);
    else if (q.paymentStatus === 'PENDING') rows = orders.filter(o => o.paymentStatus === 'PENDING');
    else if (q.paymentStatus && q.paymentStatus.$in) rows = orders.filter(o => q.paymentStatus.$in.includes(o.paymentStatus));
    const chain = { select: () => chain, sort: () => chain, limit: () => chain, lean: async () => rows };
    return chain;
  }
};

const deps = (gateway) => ({
  Order,
  fetchOrder: async id => { if (gateway[id] === 'ERR') throw new Error('net'); return { order_status: gateway[id] }; },
  isPaid: g => g.order_status === 'PAID',
  onlineAmount: () => 100
});

test('finds all four kinds of payment trouble, ignores refunded ones', async () => {
  const r = await scan(deps({ cf_d1: 'PAID', cf_d2: 'EXPIRED' }));
  const codes = r.alerts.map(a => a.code + ':' + a.orderId).sort();
  assert.deepStrictEqual(codes, [
    'CANCELLED_BUT_PAID_AT_GATEWAY:D1',
    'PAID_CANCELLED:A1',
    'PAID_NO_STOCK:B1',
    'STUCK_PENDING:C1'
  ]);
  assert.strictEqual(r.checkedGateway, 2);
});

test('a failed Cashfree lookup does not hide other alerts', async () => {
  const r = await scan(deps({ cf_d1: 'ERR', cf_d2: 'PAID' }));
  assert.ok(r.alerts.some(a => a.orderId === 'D2' && a.code === 'CANCELLED_BUT_PAID_AT_GATEWAY'));
  assert.ok(r.alerts.some(a => a.code === 'PAID_CANCELLED'));
});

test('nothing wrong -> no alerts', async () => {
  const none = { find: () => ({ select() { return this; }, sort() { return this; }, limit() { return this; }, lean: async () => [] }) };
  const r = await scan({ ...deps({}), Order: none });
  assert.deepStrictEqual(r.alerts, []);
});

test('read-only, owner-only and wired to the dashboard', () => {
  const src = fs.readFileSync('backend/services/paymentWatch.js', 'utf8');
  assert.doesNotMatch(src, /updateOne|findOneAndUpdate|\.save\(|deleteOne|create\(/);
  assert.match(fs.readFileSync('backend/routes/adminRoutes.js', 'utf8'), /'\/payment-alerts'/);
  assert.match(fs.readFileSync('admin/dashboard.html', 'utf8'), /payment-alerts\.js/);
  const { ALLOWED } = require('../backend/middleware/staffGuard');
  assert.ok(!ALLOWED.some(([, re]) => re.test('/payment-alerts')));
});
