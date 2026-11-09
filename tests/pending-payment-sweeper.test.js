'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { sweepPendingPayments } = require('../backend/services/pendingPaymentSweeper');

function deps(statusById, log) {
  const orders = Object.keys(statusById).map(id => ({
    _id: id, orderId: 'MC-' + id, cashfreeOrderId: 'cf' + id, orderStatus: 'Order Placed'
  }));

  return {
    Order: {
      find: () => ({ sort: () => ({ limit: async () => orders }) }),
      findOneAndUpdate: async f => { log.push('paid:' + f._id); return { ok: true }; }
    },
    fetchOrder: async id => ({ order_status: statusById[id.slice(2)] }),
    isPaid: g => g.order_status === 'PAID',
    fetchPayments: async () => [],
    details: { extractPaymentDetails: () => null, pickSuccessfulPayment: () => null },
    onlineAmount: () => 100,
    cancel: async o => { log.push('cancel:' + o._id); }
  };
}

test('unpaid orders are cancelled, paid ones are confirmed', async () => {
  const log = [];
  const r = await sweepPendingPayments(deps({ a: 'EXPIRED', b: 'PAID', c: 'ACTIVE' }, log));
  assert.deepStrictEqual(r, { cancelled: 2, markedPaid: 1, skipped: 0 });
  assert.deepStrictEqual(log.sort(), ['cancel:a', 'cancel:c', 'paid:b']);
});

test('one failing order does not stop the others', async () => {
  const log = [];
  const d = deps({ a: 'EXPIRED', b: 'EXPIRED' }, log);
  d.cancel = async o => { if (o._id === 'a') throw new Error('x'); log.push('cancel:' + o._id); };
  const r = await sweepPendingPayments(d);
  assert.strictEqual(r.cancelled, 1);
  assert.strictEqual(r.skipped, 1);
});
