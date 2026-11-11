'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { notifyMe } = require('../backend/controllers/stockAlertController');
const { sweepStockAlerts } = require('../backend/services/stockAlertSweeper');
const templates = require('../backend/utils/emailTemplates');

const mk = () => ({ code: 200, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } });
const ID = 'a'.repeat(24);
const mongoose = { isValidObjectId: v => /^[a-f0-9]{24}$/.test(v) };

function models(stock) {
  const saved = [];
  return {
    saved,
    Product: { findOne: () => ({ select: () => ({ lean: async () => (stock === null ? null : { stock }) }) }) },
    StockAlert: { updateOne: async (f, u, o) => { saved.push({ f, u, o }); } }
  };
}

test('rejects a bad email or unknown product', async () => {
  let r = await notifyMe({ params: { id: ID }, body: { email: 'nope' } }, mk(), { mongoose, models: models(0) });
  assert.strictEqual(r.code, 400);
  r = await notifyMe({ params: { id: ID }, body: { email: 'a@b.co' } }, mk(), { mongoose, models: models(null) });
  assert.strictEqual(r.code, 404);
});

test('saves one waiting request for an out-of-stock product (lowercased, upsert)', async () => {
  const m = models(0);
  const r = await notifyMe({ params: { id: ID }, body: { email: ' Asha@Mail.COM ' } }, mk(), { mongoose, models: m });
  assert.strictEqual(r.body.success, true);
  assert.deepStrictEqual(m.saved[0].f, { product: ID, email: 'asha@mail.com' });
  assert.strictEqual(m.saved[0].o.upsert, true);
});

test('does not save a request when the product is already in stock', async () => {
  const m = models(7);
  const r = await notifyMe({ params: { id: ID }, body: { email: 'a@b.co' } }, mk(), { mongoose, models: m });
  assert.strictEqual(r.body.inStock, true);
  assert.strictEqual(m.saved.length, 0);
});

test('sweeper emails only restocked products, once, and retries failures', async () => {
  const waiting = [
    { _id: 1, product: 'p1', email: 'a@x.com' },
    { _id: 2, product: 'p2', email: 'b@x.com' },
    { _id: 3, product: 'p1', email: 'c@x.com' }
  ];
  const done = [];
  const sent = [];
  const deps = {
    StockAlert: {
      find: () => ({ sort: () => ({ limit: () => ({ lean: async () => waiting }) }) }),
      updateOne: async f => { done.push(f._id); }
    },
    Product: { find: () => ({ select: () => ({ lean: async () => [{ _id: 'p1', name: 'Lamp', sellingPrice: 499 }] }) }) },  // p2 still out
    mail: { mailConfigured: () => true, sendMail: async m => { if (m.to === 'c@x.com') throw new Error('smtp'); sent.push(m.to); } },
    templates
  };
  const r = await sweepStockAlerts(deps);
  assert.deepStrictEqual(sent, ['a@x.com']);
  assert.deepStrictEqual(done, [1]);            // c failed -> stays waiting, p2 untouched
  assert.deepStrictEqual(r, { sent: 1, failed: 1 });
});

test('nothing is sent when email is not configured; email links to the product', async () => {
  const r = await sweepStockAlerts({ mail: { mailConfigured: () => false } });
  assert.deepStrictEqual(r, { sent: 0, failed: 0 });
  const m = templates.backInStockEmail({ _id: 'p1', name: 'Lamp', sellingPrice: 499 });
  assert.match(m.subject, /Lamp/);
  assert.match(m.html, /product\.html\?id=p1/);
});
