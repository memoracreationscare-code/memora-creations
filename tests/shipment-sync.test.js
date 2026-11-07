'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { nextOrderStatus } = require('../backend/services/shipmentSync');

test('delivered shipment marks order Delivered', () => {
  assert.strictEqual(nextOrderStatus('Shipped', { shipmentStatus: 'DELIVERED' }), 'Delivered');
  assert.strictEqual(nextOrderStatus('Packed', { deliveredAt: new Date() }), 'Delivered');
});

test('out for delivery and in transit move forward', () => {
  assert.strictEqual(nextOrderStatus('Shipped', { shipmentStatus: 'OUT FOR DELIVERY' }), 'Out for Delivery');
  assert.strictEqual(nextOrderStatus('Packed', { shipmentStatus: 'IN TRANSIT' }), 'Shipped');
  assert.strictEqual(nextOrderStatus('Confirmed', { pickedUpAt: new Date(), shipmentStatus: 'PICKED UP' }), 'Shipped');
});

test('never goes backwards or out of cancelled/delivered', () => {
  assert.strictEqual(nextOrderStatus('Out for Delivery', { shipmentStatus: 'IN TRANSIT' }), null);
  assert.strictEqual(nextOrderStatus('Delivered', { shipmentStatus: 'IN TRANSIT' }), null);
  assert.strictEqual(nextOrderStatus('Cancelled', { shipmentStatus: 'DELIVERED' }), null);
});

test('returned, lost or undelivered shipments are left to the owner', () => {
  for (const status of ['RTO DELIVERED', 'RTO INITIATED', 'UNDELIVERED', 'LOST', 'CANCELED', 'DAMAGED']) {
    assert.strictEqual(nextOrderStatus('Shipped', { shipmentStatus: status, deliveredAt: new Date() }), null, status);
  }
  assert.strictEqual(nextOrderStatus('Shipped', { shipmentStatus: 'NOT_CREATED' }), null);
});
