'use strict';

const test = require('node:test');
const assert = require('node:assert');
const Module = require('module');

const realLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === '../models') return { Order: {} };
  return realLoad.call(this, req, ...rest);
};
const { buildToday, istDayStart } = require('../backend/controllers/adminTodayController');
Module._load = realLoad;

test('India-time day starts at 18:30 UTC the evening before', () => {
  assert.strictEqual(istDayStart(new Date('2026-11-12T03:00:00Z')).toISOString(), '2026-11-11T18:30:00.000Z');
  assert.strictEqual(istDayStart(new Date('2026-11-12T19:00:00Z')).toISOString(), '2026-11-12T18:30:00.000Z');
});

test('today summary gathers the counts', async () => {
  const model = {
    countDocuments: async q => q['refund.status'] ? 2 : (q.orderStatus?.$in?.includes('Shipped') ? 3 : 5),
    aggregate: async pipeline => {
      const match = pipeline[0].$match;
      if (match.paymentStatus === 'COD_PENDING') return [{ orders: 2, amount: 450.456 }];
      return match.createdAt.$gte.toISOString() === '2026-11-11T18:30:00.000Z'
        ? [{ orders: 4, amount: 1000 }] : [{ orders: 1, amount: 250 }];
    }
  };
  const r = await buildToday(new Date('2026-11-12T03:00:00Z'), model);
  assert.deepStrictEqual(r, {
    toShip: 5, inTransit: 3, codToCollect: { orders: 2, amount: 450.46 },
    refundsProcessing: 2, today: { orders: 4, amount: 1000 }, yesterday: { orders: 1, amount: 250 }
  });
});
