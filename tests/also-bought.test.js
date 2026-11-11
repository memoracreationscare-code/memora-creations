'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { alsoBoughtFor, alsoBought } = require('../backend/controllers/alsoBoughtController');

const ser = p => ({ _id: String(p._id), name: p.name });

test('returns frequent co-purchases that are active and in stock, in order', async () => {
  let pipeline, filter;
  const models = {
    Order: { aggregate: async p => { pipeline = p; return [{ _id: 'b', orders: 5 }, { _id: 'c', orders: 3 }, { _id: 'd', orders: 2 }]; } },
    Product: { find: f => { filter = f; return { populate: () => ({ lean: async () => [{ _id: 'c', name: 'C' }, { _id: 'b', name: 'B' }] }) }; } }
  };
  const out = await alsoBoughtFor('a', models, ser);
  assert.deepStrictEqual(out.map(p => p.name), ['B', 'C']);        // most frequent first, 'd' missing/out of stock dropped
  assert.strictEqual(filter.isActive, true);
  assert.deepStrictEqual(filter.stock, { $gt: 0 });
  assert.strictEqual(pipeline[0].$match.orderStatus.$ne, 'Cancelled');  // cancelled orders ignored
  assert.ok(pipeline.some(s => s.$match && s.$match.orders && s.$match.orders.$gte >= 2)); // needs real repeat history
});

test('no history gives an empty list; bad id and database errors never break the page', async () => {
  const models = { Order: { aggregate: async () => [] }, Product: {} };
  assert.deepStrictEqual(await alsoBoughtFor('a', models, ser), []);

  const mk = () => ({ body: null, json(b) { this.body = b; return this; } });
  const mongoose = { isValidObjectId: v => v === 'ok', Types: { ObjectId: function (v) { return v; } } };
  let res = await alsoBought({ params: { id: 'bad' } }, mk(), { mongoose, models, serialize: ser });
  assert.deepStrictEqual(res.body, { success: true, products: [] });

  const boom = { Order: { aggregate: async () => { throw new Error('db'); } }, Product: {} };
  res = await alsoBought({ params: { id: 'ok' } }, mk(), { mongoose, models: boom, serialize: ser });
  assert.deepStrictEqual(res.body, { success: true, products: [] });
});
