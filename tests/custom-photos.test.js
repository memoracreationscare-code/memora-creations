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

process.env.CLOUDINARY_CLOUD_NAME = 'democloud';

const svc = require(path.join(__dirname, '..', 'backend', 'services', 'customPhotoService.js'));

const U = '64b000000000000000000001';
const good = (id = 'abc') => ({
  url: `https://res.cloudinary.com/democloud/image/upload/v1/memora-creations/customer-photos/${U}/${id}.jpg`,
  publicId: `memora-creations/customer-photos/${U}/${id}`
});
const frame = { name: 'Photo Frame', personalization: { enabled: true, maxPhotos: 2 } };

test('only the customer\'s own Cloudinary uploads are accepted', () => {
  assert.deepStrictEqual(svc.cleanPhotos([good()], U).length, 1);

  // someone else's folder
  assert.throws(() => svc.cleanPhotos([good()], '64b000000000000000000002'), /not valid/);
  // another website / another cloud
  assert.throws(() => svc.cleanPhotos([{ url: 'https://evil.example/x.jpg', publicId: good().publicId }], U), /not valid/);
  assert.throws(() => svc.cleanPhotos([{ url: good().url.replace('democloud', 'other'), publicId: good().publicId }], U), /not valid/);
  // path tricks
  assert.throws(() => svc.cleanPhotos([{ url: good().url, publicId: good().publicId + '/../../products/x' }], U), /not valid/);
  // duplicates collapse
  assert.strictEqual(svc.cleanPhotos([good(), good()], U).length, 1);
});

test('photo frame needs 1..max photos; other products ignore photos', () => {
  assert.throws(() => svc.checkCustomization(frame, [], '', U), /upload karein/);
  assert.throws(() => svc.checkCustomization(frame, undefined, '', U), /upload karein/);
  assert.throws(() => svc.checkCustomization(frame, [good('a'), good('b'), good('c')], '', U), /maximum 2/);

  const ok = svc.checkCustomization(frame, [good('a')], '  Naam: Riya\u0000  ', U);
  assert.strictEqual(ok.photos.length, 1);
  assert.strictEqual(ok.note, 'Naam: Riya');

  const plain = svc.checkCustomization({ name: 'Vase' }, [good()], 'x', U);
  assert.deepStrictEqual(plain, { photos: [], note: '' });
});

test('note is trimmed to 300 characters', () => {
  assert.strictEqual(svc.cleanNote('a'.repeat(900)).length, 300);
});

test('keep days: default 30, kept within 3..365', () => {
  assert.strictEqual(svc.keepDays({}), 30);
  assert.strictEqual(svc.keepDays({ customPhotoKeepDays: 1 }), 3);
  assert.strictEqual(svc.keepDays({ customPhotoKeepDays: 9999 }), 365);
  assert.strictEqual(svc.keepDays({ customPhotoKeepDays: 45 }), 45);
});

test('sweep deletes old delivered/cancelled order photos and unused uploads, keeps the rest', async () => {
  const now = new Date('2026-12-30T00:00:00Z');
  const deleted = [];
  const updates = [];
  let orderQuery;

  const orders = [{ _id: 'o1', items: [{ customPhotos: [good('keep1')] }] }];

  const models = {
    Order: {
      find: q => { orderQuery = q; return { limit: async () => orders }; },
      updateOne: async (...a) => { updates.push(a); },
      exists: async q => (q['items.customPhotos.publicId'].endsWith('/inuse') ? { _id: 1 } : null)
    },
    Cart: { exists: async () => null }
  };

  const client = {
    api: {
      delete_resources: async ids => { deleted.push(...ids); return { deleted: Object.fromEntries(ids.map(i => [i, 'deleted'])) }; },
      resources: async () => ({
        resources: [
          { public_id: good('keep1').publicId, created_at: '2026-10-01T00:00:00Z' },
          { public_id: good('inuse').publicId, created_at: '2026-10-01T00:00:00Z' },
          { public_id: good('abandoned').publicId, created_at: '2026-12-01T00:00:00Z' },
          { public_id: good('fresh').publicId, created_at: '2026-12-29T23:00:00Z' }
        ]
      })
    }
  };

  const r = await svc.sweepCustomPhotos({ models, client, settings: { customPhotoKeepDays: 30 } }, now);

  // cut-offs: delivered 30 days ago, cancelled 7 days ago
  const clauses = orderQuery.$or;
  assert.strictEqual(clauses[0].statusHistory.$elemMatch.changedAt.$lt.toISOString(), '2026-11-30T00:00:00.000Z');
  assert.strictEqual(clauses[1].statusHistory.$elemMatch.changedAt.$lt.toISOString(), '2026-12-23T00:00:00.000Z');
  assert.strictEqual(orderQuery.customPhotosDeletedAt, null);

  assert.ok(deleted.includes(good('keep1').publicId));
  assert.ok(deleted.includes(good('abandoned').publicId));
  assert.ok(!deleted.includes(good('inuse').publicId), 'photo used by an order must stay');
  assert.ok(!deleted.includes(good('fresh').publicId), 'recent upload must stay');
  assert.strictEqual(updates.length, 1);
  assert.ok(updates[0][1].$set.customPhotosDeletedAt instanceof Date);
  assert.strictEqual(r.orders, 1);
});

test('destroy refuses anything outside the customer photo folder', async () => {
  const seen = [];
  const client = { api: { delete_resources: async ids => { seen.push(...ids); return { deleted: {} }; } } };

  await svc.destroyPhotos(['memora-creations/products/real-product', good('x').publicId], client);

  assert.deepStrictEqual(seen, [good('x').publicId]);
});

const fs = require('node:fs');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('wiring: product flag, admin form, cart, checkout, orders and cleanup are all connected', () => {
  assert.match(read('backend/models/Product.js'), /personalization: \{[\s\S]*maxPhotos/);
  assert.match(read('backend/models/Order.js'), /customPhotos:[\s\S]*customPhotosDeletedAt/);
  assert.match(read('backend/models/Cart.js'), /customPhotos/);
  assert.match(read('backend/server.js'), /\/api\/custom-photos/);
  assert.match(read('backend/routes/adminRoutes.js'), /orders\/:id\/custom-photos/);
  assert.match(read('backend/services/notificationSweeper.js'), /customPhotoService'\)\.maybeSweep/);
  assert.match(read('backend/controllers/adminSettingsController.js'), /customPhotoKeepDays: \[3, 365\]/);
  assert.match(read('admin/js/settings.js'), /customPhotoKeepDays/);
  assert.match(read('admin/products.html'), /id="photoNeeded"/);
  assert.match(read('admin/js/products.js'), /personalization: \{/);
  assert.match(read('admin/js/orders.js'), /itemPhotosHtml\(item, order\)/);
  assert.match(read('frontend/js/checkout.js'), /customPhotos: x\.customPhotos/);
  assert.match(read('frontend/js/checkout.js'), /setupPhotoStep/);
  assert.match(read('frontend/js/checkout.js'), /verifyBeforePayment\(\) \{\s*collectPhotos\(\)/);
  assert.match(read('frontend/checkout.html'), /custom-photo\.js/);
});

test('staff cannot delete customer photos (owner only)', () => {
  assert.ok(!/custom-photos/.test(read('backend/middleware/staffGuard.js')));
});

test('before checkout (cart / price preview) photos are optional; placing the order still needs them', () => {
  assert.deepStrictEqual(svc.checkCustomization(frame, [], 'x', U, { required: false }), { photos: [], note: 'x' });
  assert.throws(() => svc.checkCustomization(frame, [], 'x', U), /upload karein/);
});
