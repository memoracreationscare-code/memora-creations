'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const Module = require('node:module');

const realLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'mongoose') return {};
  return realLoad.call(this, request, ...rest);
};

const root = path.join(__dirname, '..', 'backend');
const stub = (rel, exports) => {
  const file = require.resolve(path.join(root, rel));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
};

const seenRows = [];
const queries = {};
const upserts = [];
const count = name => async q => { queries[name] = q; return 3; };

stub('models/index.js', {
  Order: { countDocuments: async q => { (queries.order = queries.order || []).push(q); return 2; } },
  Product: { countDocuments: count('product') },
  Review: { countDocuments: count('review') },
  User: { countDocuments: count('user') },
  AdminSeen: {
    find: () => ({ lean: async () => seenRows }),
    updateOne: async (...a) => { upserts.push(a); }
  }
});

const { pendingCounts, markSeen, SEEN_SECTIONS } = require(path.join(root, 'controllers/adminAlertsController.js'));

const run = (handler, req) => new Promise((resolve, reject) => {
  const res = { json: b => resolve(b), status() { return this; } };
  handler(req, res, reject);
});

test('only requests newer than the last visit are counted', async () => {
  const seenAt = new Date('2026-11-14T02:00:00Z');
  seenRows.length = 0;
  seenRows.push({ section: 'returns', seenAt }, { section: 'passwordResets', seenAt });

  await run(pendingCounts, { admin: { _id: 'a1', role: 'admin' } });

  assert.strictEqual(queries.user.passwordResetRequestedAt.$gt, seenAt);
  assert.ok(queries.order.some(q => q['returnRequest.requestedAt'] && q['returnRequest.requestedAt'].$gt === seenAt));
  // never visited -> everything pending shows once
  assert.strictEqual(queries.review.createdAt.$gt.getTime(), 0);
});

test('opening a page records the visit; unknown sections are refused', async () => {
  upserts.length = 0;
  await run(markSeen, { admin: { _id: 'a1' }, body: { section: 'returns' } });
  assert.strictEqual(upserts.length, 1);
  assert.deepStrictEqual(upserts[0][0], { admin: 'a1', section: 'returns' });
  assert.ok(upserts[0][1].$set.seenAt instanceof Date);
  assert.deepStrictEqual(upserts[0][2], { upsert: true });

  await assert.rejects(run(markSeen, { admin: { _id: 'a1' }, body: { section: 'settings' } }), /Unknown section/);
});

test('cancellations page clears both cancellation alerts; staff see only orders and returns', async () => {
  assert.deepStrictEqual(SEEN_SECTIONS.cancellations, ['cancellations', 'cancelFollowUps']);

  const r = await run(pendingCounts, { admin: { _id: 's1', role: 'staff' } });
  const d = r.data || r;
  assert.strictEqual(d.reviews, 0);
  assert.strictEqual(d.passwordResets, 0);
  assert.strictEqual(d.orders, 2);
});
