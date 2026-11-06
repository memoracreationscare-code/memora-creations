'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  buildAbandonedCarts,
  clampMinHours
} = require('../backend/utils/abandonedCarts');

const NOW = new Date('2026-11-06T12:00:00Z');
const hoursAgo = h => new Date(NOW.getTime() - h * 3600 * 1000);

const product = (over = {}) => ({
  name: 'Wall Frame',
  sellingPrice: 499,
  stock: 5,
  isActive: true,
  ...over
});

const cart = (over = {}) => ({
  _id: 'c1',
  updatedAt: hoursAgo(5),
  user: { _id: 'u1', fullName: 'Asha', mobile: '9876543210', isActive: true },
  items: [{ product: product(), quantity: 2 }],
  ...over
});

const run = (carts, extra = {}) =>
  buildAbandonedCarts({
    carts,
    latestOrderByUser: new Map(),
    now: NOW,
    ...extra
  });

test('lists an old cart with totals', () => {
  const [row] = run([cart()]);

  assert.equal(row.fullName, 'Asha');
  assert.equal(row.mobile, '9876543210');
  assert.equal(row.itemCount, 2);
  assert.equal(row.total, 998);
  assert.equal(row.hoursAgo, 5);
});

test('skips a cart touched less than minHours ago', () => {
  assert.equal(run([cart({ updatedAt: hoursAgo(1) })]).length, 0);
  assert.equal(run([cart({ updatedAt: hoursAgo(0.5) })], { minHours: 0.5 }).length, 0);
  assert.equal(run([cart({ updatedAt: hoursAgo(3) })], { minHours: 4 }).length, 0);
});

test('skips carts older than 30 days', () => {
  assert.equal(run([cart({ updatedAt: hoursAgo(24 * 31) })]).length, 0);
  assert.equal(run([cart({ updatedAt: hoursAgo(24 * 29) })]).length, 1);
});

test('skips a customer who ordered after the cart was last changed', () => {
  const latest = new Map([['u1', hoursAgo(2)]]);

  assert.equal(run([cart()], { latestOrderByUser: latest }).length, 0);
});

test('keeps a customer whose last order is older than the cart change', () => {
  const latest = new Map([['u1', hoursAgo(50)]]);

  assert.equal(run([cart()], { latestOrderByUser: latest }).length, 1);
});

test('skips inactive customers and missing users', () => {
  const inactive = cart({ user: { _id: 'u2', fullName: 'B', mobile: '9000000000', isActive: false } });

  assert.equal(run([inactive]).length, 0);
  assert.equal(run([cart({ user: null })]).length, 0);
});

test('ignores deleted or inactive products and skips empty result', () => {
  const mixed = cart({
    items: [
      { product: null, quantity: 1 },
      { product: product({ isActive: false }), quantity: 1 },
      { product: product({ name: 'Lamp', sellingPrice: 300 }), quantity: 1 }
    ]
  });

  const [row] = run([mixed]);

  assert.equal(row.items.length, 1);
  assert.equal(row.total, 300);

  const none = cart({ items: [{ product: null, quantity: 1 }] });

  assert.equal(run([none]).length, 0);
});

test('flags out-of-stock items and sorts newest first', () => {
  const older = cart({ _id: 'old', updatedAt: hoursAgo(30), items: [{ product: product({ stock: 0 }), quantity: 1 }] });
  const newer = cart({ _id: 'new', updatedAt: hoursAgo(4) });

  const rows = run([older, newer]);

  assert.deepEqual(rows.map(r => r.cartId), ['new', 'old']);
  assert.equal(rows[1].items[0].inStock, false);
});

test('clampMinHours keeps the value sane', () => {
  assert.equal(clampMinHours(undefined), 2);
  assert.equal(clampMinHours('abc'), 2);
  assert.equal(clampMinHours(0), 1);
  assert.equal(clampMinHours(9999), 168);
  assert.equal(clampMinHours('24'), 24);
});
