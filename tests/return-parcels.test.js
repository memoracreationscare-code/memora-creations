'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { classifyParcelStatus } = require('../backend/utils/returnParcels');

test('classifies problem parcels', () => {
  assert.strictEqual(classifyParcelStatus('UNDELIVERED'), 'undelivered');
  assert.strictEqual(classifyParcelStatus('Undelivered-1st Attempt'), 'undelivered');
  assert.strictEqual(classifyParcelStatus('RTO INITIATED'), 'returning');
  assert.strictEqual(classifyParcelStatus('RTO IN TRANSIT'), 'returning');
  assert.strictEqual(classifyParcelStatus('RTO DELIVERED'), 'returned');
  assert.strictEqual(classifyParcelStatus('LOST'), 'lost');
  assert.strictEqual(classifyParcelStatus('DAMAGED'), 'lost');
});

test('normal parcels are not listed', () => {
  for (const s of ['DELIVERED', 'IN TRANSIT', 'OUT FOR DELIVERY', 'PICKED UP', 'NOT_CREATED', '', null]) {
    assert.strictEqual(classifyParcelStatus(s), null, String(s));
  }
});
