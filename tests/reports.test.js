'use strict';

const test = require('node:test');
const assert = require('node:assert');
const Module = require('module');

const realLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === '../models') return { Order: {} };
  return realLoad.call(this, req, ...rest);
};
const { range, istDay, buildReport } = require('../backend/controllers/adminReportsController');
Module._load = realLoad;

test('dates are read as India days; to-date is included', () => {
  assert.strictEqual(istDay('2026-11-12').toISOString(), '2026-11-11T18:30:00.000Z');
  assert.strictEqual(istDay('12/11/2026'), null);
  const r = range({ from: '2026-11-01', to: '2026-11-30' });
  assert.strictEqual(r.to.toISOString(), '2026-11-30T18:30:00.000Z');
});

test('default range is this month so far; bad ranges are refused', () => {
  const r = range({}, new Date('2026-11-12T05:00:00Z'));
  assert.strictEqual(r.from.toISOString(), '2026-10-31T18:30:00.000Z');
  assert.throws(() => range({ from: '2026-11-10', to: '2026-11-01' }), /must not be before/);
  assert.throws(() => range({ from: '2024-01-01', to: '2026-01-01' }), /one year/);
});

test('report is shaped and rounded', async () => {
  const answers = [
    [{ orders: 2, revenue: 1000.456 }],
    [{ _id: 'Lamp', quantity: 3, revenue: 900 }],
    [{ _id: 'Delhi', orders: 2, revenue: 1000.456 }],
    [{ _id: 'COD', orders: 2, revenue: 1000.456 }],
    [{ _id: '2026-11-12', orders: 2, revenue: 1000.456 }]
  ];
  let i = 0;
  const model = { aggregate: async () => answers[i++], countDocuments: async () => 1 };
  const r = await buildReport(new Date('2026-11-01'), new Date('2026-12-01'), model);
  assert.deepStrictEqual(r.summary, { orders: 2, revenue: 1000.46, average: 500.23, cancelled: 1 });
  assert.deepStrictEqual(r.products, [{ name: 'Lamp', quantity: 3, revenue: 900 }]);
  assert.strictEqual(r.states[0].state, 'Delhi');
});
