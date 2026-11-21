'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { sweepPriceDrops, isDrop } = require('../backend/services/priceDropSweeper');
const templates = require('../backend/utils/emailTemplates');

function make({ seen, price, on = true, configured = true, fail = false, email = 'a@b.in' }) {
  const log = { mails: [], saved: [] };
  const list = { _id: 'L1', user: 'U1', products: ['P1'], seenPrices: seen };
  return {
    log,
    deps: {
      settings: { peek: () => ({ emailNotificationsEnabled: on, priceDropEmailEnabled: on }) },
      mail: { mailConfigured: () => configured, sendMail: async m => { if (fail) throw new Error('x'); log.mails.push(m); } },
      templates,
      Wishlist: {
        find: () => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [list] }) }) }) }),
        updateOne: async (f, u) => { log.saved.push(u.$set.seenPrices); }
      },
      Product: { find: () => ({ select: () => ({ lean: async () => [{ _id: 'P1', name: 'Frame', sellingPrice: price }] }) }) },
      User: { findOne: () => ({ select: () => ({ lean: async () => (email ? { fullName: 'Ravi K', email } : null) }) }) }
    }
  };
}

test('isDrop needs 3% and Rs 10', () => {
  assert.ok(isDrop(500, 450));
  assert.ok(!isDrop(500, 495));
  assert.ok(!isDrop(100, 95));
});

test('first sight only remembers the price', async () => {
  const m = make({ seen: undefined, price: 400 });
  const r = await sweepPriceDrops(m.deps);
  assert.strictEqual(r.sent, 0);
  assert.deepStrictEqual(m.log.saved[0], { P1: 400 });
});

test('a real drop sends one email and remembers the new price', async () => {
  const m = make({ seen: { P1: 500 }, price: 400 });
  const r = await sweepPriceDrops(m.deps);
  assert.strictEqual(r.sent, 1);
  assert.match(m.log.mails[0].subject, /Frame/);
  assert.deepStrictEqual(m.log.saved[0], { P1: 400 });
});

test('price rise is remembered silently', async () => {
  const m = make({ seen: { P1: 300 }, price: 400 });
  const r = await sweepPriceDrops(m.deps);
  assert.strictEqual(r.sent, 0);
  assert.deepStrictEqual(m.log.saved[0], { P1: 400 });
});

test('failed send keeps the old price so it is retried', async () => {
  const m = make({ seen: { P1: 500 }, price: 400, fail: true });
  const r = await sweepPriceDrops(m.deps);
  assert.strictEqual(r.failed, 1);
  assert.strictEqual(m.log.saved.length, 0);
});

test('off switch or no mail service does nothing', async () => {
  for (const o of [{ on: false }, { configured: false }]) {
    const m = make({ seen: { P1: 500 }, price: 400, ...o });
    const r = await sweepPriceDrops(m.deps);
    assert.strictEqual(r.sent, 0);
    assert.strictEqual(m.log.saved.length, 0);
  }
});

test('customer without email: no mail, price remembered', async () => {
  const m = make({ seen: { P1: 500 }, price: 400, email: '' });
  const r = await sweepPriceDrops(m.deps);
  assert.strictEqual(r.sent, 0);
  assert.deepStrictEqual(m.log.saved[0], { P1: 400 });
});
