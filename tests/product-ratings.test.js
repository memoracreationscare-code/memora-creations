'use strict';

const test = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');

// reviewController loads ../models (mongoose); stub it so no database is needed.
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'mongoose') return { isValidObjectId: () => true };
  if (request === '../models') return { Product: {}, Order: {}, Review: {} };
  return origLoad.call(this, request, ...rest);
};
const { refreshProductRating } = require('../backend/controllers/reviewController');
Module._load = origLoad;

const { wantedEvents } = require('../backend/services/notificationSweeper');
const templates = require('../backend/utils/emailTemplates');

test('product rating is the average of approved reviews, rounded to 1 decimal', async () => {
  let saved;
  const models = {
    Review: { aggregate: async p => { assert.strictEqual(p[0].$match.status, 'APPROVED'); return [{ avg: 4.333, count: 3 }]; } },
    Product: { updateOne: async (f, u) => { saved = u.$set; } }
  };
  assert.deepStrictEqual(await refreshProductRating('p1', models), { ratingAverage: 4.3, ratingCount: 3 });
  assert.deepStrictEqual(saved, { ratingAverage: 4.3, ratingCount: 3 });
});

test('no approved reviews resets the rating to 0', async () => {
  const models = { Review: { aggregate: async () => [] }, Product: { updateOne: async () => {} } };
  assert.deepStrictEqual(await refreshProductRating('p1', models), { ratingAverage: 0, ratingCount: 0 });
});

const now = new Date('2026-11-20T10:00:00Z');
const delivered = (daysAgo, extra = {}) => ({
  orderStatus: 'Delivered', paymentMethod: 'COD', paymentStatus: 'SUCCESS',
  notificationsSent: ['DELIVERED'],
  statusHistory: [{ status: 'Delivered', changedAt: new Date(now.getTime() - daysAgo * 86400000) }],
  ...extra
});

test('review request goes out 4+ days after delivery, once', () => {
  assert.deepStrictEqual(wantedEvents(delivered(2), now), []);
  assert.deepStrictEqual(wantedEvents(delivered(5), now), ['REVIEW_REQUEST']);
  assert.deepStrictEqual(wantedEvents(delivered(5, { notificationsSent: ['DELIVERED', 'REVIEW_REQUEST'] }), now), []);
});

test('no review request while a return is pending, or before the delivered email', () => {
  assert.deepStrictEqual(wantedEvents(delivered(5, { returnRequest: { status: 'REQUESTED' } }), now), []);
  assert.deepStrictEqual(wantedEvents(delivered(5, { notificationsSent: [] }), now), ['DELIVERED']);
});

test('review request email links to My Orders', () => {
  const m = templates.orderEmail('REVIEW_REQUEST', { _id: 'x', orderId: 'MC1', items: [], grandTotal: 100 });
  assert.match(m.subject, /MC1/);
  assert.match(m.html, /orders\.html/);
});
