'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { checkEligibility, deliveredAt } = require('../backend/utils/returnRequests');

const day = 24 * 60 * 60 * 1000;
const now = new Date('2026-11-10T10:00:00Z');
const delivered = daysAgo => ({
  orderStatus: 'Delivered',
  statusHistory: [
    { status: 'Shipped', changedAt: new Date(now - 9 * day) },
    { status: 'Delivered', changedAt: new Date(now - daysAgo * day) }
  ]
});

test('delivered within window is eligible', () => {
  assert.strictEqual(checkEligibility(delivered(2), now).ok, true);
  assert.strictEqual(checkEligibility(delivered(6.9), now).ok, true);
});

test('too old, not delivered, or already requested is not eligible', () => {
  assert.strictEqual(checkEligibility(delivered(8), now).ok, false);
  assert.strictEqual(checkEligibility({ orderStatus: 'Shipped', statusHistory: [] }, now).ok, false);
  assert.strictEqual(
    checkEligibility({ ...delivered(1), returnRequest: { status: 'REQUESTED' } }, now).ok,
    false
  );
});

test('uses the latest Delivered entry', () => {
  assert.strictEqual(deliveredAt(delivered(3)).getTime(), now - 3 * day);
});
