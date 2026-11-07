'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { classifyCodOrder, summarize } = require('../backend/utils/codRemittance');

const now = new Date('2026-11-20T00:00:00Z');

test('shipped orders are with the courier', () => {
  assert.strictEqual(classifyCodOrder({ orderStatus: 'Shipped' }, { shipmentStatus: 'IN TRANSIT' }, now).stage, 'atCourier');
  assert.strictEqual(classifyCodOrder({ orderStatus: 'Out for Delivery' }, null, now).stage, 'atCourier');
});

test('delivered and unpaid means money awaited with expected dates', () => {
  const order = { orderStatus: 'Delivered', paymentStatus: 'COD_PENDING', statusHistory: [{ status: 'Delivered', changedAt: '2026-11-10T00:00:00Z' }] };
  const info = classifyCodOrder(order, null, now);

  assert.strictEqual(info.stage, 'awaiting');
  assert.strictEqual(info.daysSinceDelivery, 10);
  assert.strictEqual(info.expectedFrom.toISOString(), '2026-11-18T00:00:00.000Z');
  assert.strictEqual(info.expectedTo.toISOString(), '2026-11-19T00:00:00.000Z');
});

test('delivered and paid is received', () => {
  assert.strictEqual(classifyCodOrder({ orderStatus: 'Delivered', paymentStatus: 'SUCCESS' }, null, now).stage, 'received');
});

test('returned or undelivered parcels are not collected', () => {
  assert.strictEqual(classifyCodOrder({ orderStatus: 'Shipped' }, { shipmentStatus: 'RTO IN TRANSIT' }, now).stage, 'notCollected');
  assert.strictEqual(classifyCodOrder({ orderStatus: 'Shipped' }, { shipmentStatus: 'UNDELIVERED' }, now).stage, 'notCollected');
});

test('unshipped orders and totals', () => {
  assert.strictEqual(classifyCodOrder({ orderStatus: 'Packed' }, null, now).stage, 'notShipped');

  const { totals, counts } = summarize([
    { stage: 'awaiting', amount: 500 },
    { stage: 'awaiting', amount: 250 },
    { stage: 'received', amount: 100 }
  ]);

  assert.strictEqual(totals.awaiting, 750);
  assert.strictEqual(counts.awaiting, 2);
  assert.strictEqual(totals.received, 100);
});
