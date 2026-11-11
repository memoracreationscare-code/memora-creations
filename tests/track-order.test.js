'use strict';

const test = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');

const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'mongoose') return {};
  return origLoad.call(this, request, ...rest);
};
const { trackOrder } = require('../backend/controllers/trackOrderController');
Module._load = origLoad;

const mkRes = () => ({ code: 200, body: null, set() {}, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } });
const order = { _id: 'o1', orderId: 'MC_1', orderStatus: 'Shipped', createdAt: new Date(), items: [{ name: 'Lamp', quantity: 2 }],
  statusHistory: [{ status: 'Order Placed', changedAt: new Date(), note: 'ADMIN SECRET' }] };

function deps({ found = order, shipment = null } = {}) {
  let query;
  return {
    get query() { return query; },
    refresh: async s => ({ ...s, shipmentStatus: 'IN_TRANSIT' }),
    models: {
      Order: { findOne: q => { query = q; return { select: () => ({ lean: async () => found }) }; } },
      ShipmentTracking: { findOne: () => ({ lean: async () => shipment }) }
    }
  };
}

test('rejects malformed input without touching the database', async () => {
  const d = deps();
  let res = await trackOrder({ body: { orderId: 'x', mobile: '9876543210' } }, mkRes(), d);
  assert.strictEqual(res.code, 400);
  res = await trackOrder({ body: { orderId: 'MC_1', mobile: '12345' } }, mkRes(), d);
  assert.strictEqual(res.code, 400);
  assert.strictEqual(d.query, undefined);
});

test('looks up by order number AND mobile (last 10 digits)', async () => {
  const d = deps();
  await trackOrder({ body: { orderId: 'MC_1', mobile: '+91 98765 43210' } }, mkRes(), d);
  assert.deepStrictEqual(d.query, { orderId: 'MC_1', 'shippingAddress.mobile': '9876543210' });
});

test('wrong mobile / unknown order gives the same 404', async () => {
  const res = await trackOrder({ body: { orderId: 'MC_1', mobile: '9876543210' } }, mkRes(), deps({ found: null }));
  assert.strictEqual(res.code, 404);
});

test('returns a safe summary: no notes, no address, https tracking link only', async () => {
  const shipment = { awbCode: 'AWB1', courierName: 'Delhivery', trackingUrl: 'http://evil.test/x', shipmentStatus: 'X' };
  const res = await trackOrder({ body: { orderId: 'MC_1', mobile: '9876543210' } }, mkRes(), deps({ shipment }));
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.shipment.trackingUrl, null);
  assert.strictEqual(res.body.shipment.status, 'IN_TRANSIT');
  assert.ok(!JSON.stringify(res.body).includes('ADMIN SECRET'));
  assert.deepStrictEqual(Object.keys(res.body.history[0]), ['status', 'at']);
});
