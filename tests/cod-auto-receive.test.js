'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { autoReceiveCod } = require('../backend/services/codAutoReceive');

const day = 24 * 60 * 60 * 1000;
const now = new Date('2026-11-20T00:00:00Z');
const ord = (id, daysAgo, extra = {}) => ({
  _id: id, paymentMethod: 'COD', paymentStatus: 'COD_PENDING',
  statusHistory: [{ status: 'Delivered', changedAt: new Date(now - daysAgo * day) }], ...extra
});

function fakeOrder(list, updates) {
  return {
    find: () => ({ select: () => ({ limit: () => ({ lean: async () => list }) }) }),
    updateOne: async (f, u) => { updates.push({ f, u }); return { modifiedCount: 1 }; }
  };
}

test('off by default', async () => {
  delete process.env.COD_AUTO_RECEIVE_DAYS;
  const updates = [];
  const r = await autoReceiveCod(fakeOrder([ord('a', 30)], updates), now);
  assert.strictEqual(r.updated, 0);
  assert.strictEqual(updates.length, 0);
});

test('marks only orders delivered long enough ago', async () => {
  process.env.COD_AUTO_RECEIVE_DAYS = '8';
  const updates = [];
  const adv = ord('c', 10, { codAdvance: { enabled: true, balanceStatus: 'PENDING' }, paymentStatus: 'SUCCESS' });
  const r = await autoReceiveCod(fakeOrder([ord('a', 9), ord('b', 3), adv], updates), now);
  delete process.env.COD_AUTO_RECEIVE_DAYS;
  assert.strictEqual(r.updated, 2);
  assert.deepStrictEqual(updates.map(x => x.f._id), ['a', 'c']);
  assert.strictEqual(updates[0].u.$set.paymentStatus, 'SUCCESS');
  assert.strictEqual(updates[1].u.$set['codAdvance.balanceStatus'], 'RECEIVED');
});
