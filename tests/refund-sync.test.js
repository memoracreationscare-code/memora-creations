'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { sweepRefunds, summarizeRefunds } = require('../backend/services/refundSync');

const mkOrder = (extra = {}) => ({
  _id: 'o1', orderId: 'MC-1', cashfreeOrderId: 'cf1', orderStatus: 'Order Placed',
  statusHistory: [], saved: 0, markModified() {},
  async save() { this.saved += 1; }, ...extra
});

function deps(order, refunds, log) {
  return {
    Order: {
      find: () => ({ sort: () => ({ limit: async () => [order] }) }),
      updateOne: async () => { log.push('checked'); }
    },
    getRefunds: async () => refunds,
    onlineAmount: () => 49,
    cancellation: {
      cancelInDatabase: async o => { log.push('cancel'); o.orderStatus = 'Cancelled'; return o; },
      cancelShiprocketIfBooked: async () => { log.push('shiprocket'); return ''; }
    }
  };
}

test('summarize ignores failed refunds', () => {
  const s = summarizeRefunds([
    { refund_status: 'SUCCESS', refund_amount: 30 },
    { refund_status: 'CANCELLED', refund_amount: 99 },
    { refund_status: 'PENDING', refund_amount: 19 }
  ]);
  assert.deepStrictEqual([s.total, s.done, s.status], [49, 30, 'PROCESSING']);
});

test('full manual refund cancels an unshipped order and records it', async () => {
  const log = []; const order = mkOrder();
  const r = await sweepRefunds(deps(order, [{ refund_status: 'SUCCESS', refund_amount: 49 }], log));
  assert.strictEqual(order.orderStatus, 'Cancelled');
  assert.strictEqual(order.refund.status, 'REFUNDED');
  assert.deepStrictEqual(log, ['cancel', 'shiprocket']);
  assert.strictEqual(r.cancelled, 1);
});

test('refund on a shipped order is recorded but order is not cancelled', async () => {
  const log = []; const order = mkOrder({ orderStatus: 'Shipped' });
  await sweepRefunds(deps(order, [{ refund_status: 'SUCCESS', refund_amount: 49 }], log));
  assert.strictEqual(order.orderStatus, 'Shipped');
  assert.strictEqual(order.refund.status, 'REFUNDED');
  assert.ok(!log.includes('cancel'));
});

test('no refund only marks the order as checked', async () => {
  const log = []; const order = mkOrder();
  await sweepRefunds(deps(order, [], log));
  assert.deepStrictEqual(log, ['checked']);
  assert.strictEqual(order.saved, 0);
});
