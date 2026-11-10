'use strict';

const test = require('node:test');
const assert = require('node:assert');
const Module = require('module');

// mongoose and the models are not needed for the pure parts: stub them.
const realLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === 'mongoose') return { connection: { collection: () => ({}) } };
  if (req === '../models') return { Order: {}, Product: {} };
  return realLoad.call(this, req, ...rest);
};
const { runCleanup, cutoffFrom, skipReason } = require('../backend/controllers/adminCleanupController');
Module._load = realLoad;

const o = (id, extra = {}) => ({ _id: id, orderId: 'MC-' + id, paymentMethod: 'COD', paymentStatus: 'COD_PENDING', grandTotal: 100, ...extra });

test('cut-off is never in the future', () => {
  const now = new Date('2026-11-10T10:00:00Z');
  assert.strictEqual(cutoffFrom('2026-12-01', now).getTime(), now.getTime());
  assert.strictEqual(cutoffFrom('2026-11-01', now).toISOString().slice(0, 10), '2026-11-01');
  assert.throws(() => cutoffFrom('not a date'), /not valid/);
});

test('paid-but-not-refunded online orders are protected', () => {
  assert.ok(skipReason(o('1', { paymentMethod: 'CASHFREE', paymentStatus: 'SUCCESS' })));
  assert.strictEqual(skipReason(o('2', { paymentMethod: 'CASHFREE', paymentStatus: 'SUCCESS', refund: { status: 'REFUNDED' } })), '');
  assert.strictEqual(skipReason(o('3')), '');
});

test('backup happens before delete, stock is restored, protected orders stay', async () => {
  const log = [];
  const orders = [o('a'), o('b', { stockReserved: true }), o('c', { paymentMethod: 'CASHFREE', paymentStatus: 'SUCCESS' })];
  const r = await runCleanup(null, {
    orders,
    backup: async docs => { log.push('backup:' + docs.map(d => d._id)); },
    restock: async x => { log.push('restock:' + x._id); },
    remove: async ids => { log.push('delete:' + ids); }
  });
  assert.deepStrictEqual(r, { deleted: 2, skipped: 1 });
  assert.deepStrictEqual(log, ['backup:a,b', 'restock:a', 'restock:b', 'delete:a,b']);
});

test('if the backup fails nothing is deleted', async () => {
  let deleted = false;
  await assert.rejects(runCleanup(null, {
    orders: [o('a')],
    backup: async () => { throw new Error('db down'); },
    restock: async () => {},
    remove: async () => { deleted = true; }
  }), /db down/);
  assert.strictEqual(deleted, false);
});
