'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const Module = require('node:module');

const realLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'mongoose') return { isValidObjectId: v => /^[a-f0-9]{24}$/i.test(String(v)), Types: {} };
  return realLoad.call(this, request, ...rest);
};

process.env.CLOUDINARY_CLOUD_NAME = 'democloud';

const root = path.join(__dirname, '..', 'backend');
const stub = (rel, exports) => {
  const file = require.resolve(path.join(root, rel));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
};

const FRAME = '64b0000000000000000000f1';
const VASE = '64b0000000000000000000f2';
const U = '64b000000000000000000001';

const products = [
  { _id: FRAME, productId: 'P1', name: 'Photo Frame', sellingPrice: 549, stock: 20, images: [], variants: [], personalization: { enabled: true, maxPhotos: 2 } },
  { _id: VASE, productId: 'P2', name: 'Vase', sellingPrice: 249, stock: 20, images: [], variants: [] }
];

stub('models/index.js', {
  Product: { find: q => ({ populate: () => ({ lean: async () => products.filter(p => q._id.$in.includes(p._id)) }) }) },
  Order: {}, Coupon: {}, Cart: {}, User: {}
});

const { getTrustedItems } = require(path.join(root, 'services', 'orderService.js'));

const photo = id => ({
  url: `https://res.cloudinary.com/democloud/image/upload/v1/memora-creations/customer-photos/${U}/${id}.jpg`,
  publicId: `memora-creations/customer-photos/${U}/${id}`
});

test('photo frame without photo cannot be ordered', async () => {
  await assert.rejects(getTrustedItems([{ productId: FRAME, quantity: 1 }], U), /photo upload karein/);
});

test('photo frame with the customer\'s photo is accepted and photos are kept on the line', async () => {
  const out = await getTrustedItems([{ productId: FRAME, quantity: 1, customPhotos: [photo('a')], customNote: 'Happy Birthday' }], U);

  assert.strictEqual(out.length, 1);
  assert.strictEqual(out[0].customPhotos[0].publicId, photo('a').publicId);
  assert.strictEqual(out[0].customNote, 'Happy Birthday');
});

test('two frames with different photos stay two separate lines', async () => {
  const out = await getTrustedItems([
    { productId: FRAME, quantity: 1, customPhotos: [photo('a')] },
    { productId: FRAME, quantity: 1, customPhotos: [photo('b')] },
    { productId: VASE, quantity: 2 },
    { productId: VASE, quantity: 1 }
  ], U);

  assert.strictEqual(out.length, 3);
  assert.strictEqual(out[0].customPhotos[0].publicId, photo('a').publicId);
  assert.strictEqual(out[1].customPhotos[0].publicId, photo('b').publicId);
  assert.strictEqual(out[2].quantity, 3, 'normal products still merge');
});

test('another customer\'s photo is refused', async () => {
  await assert.rejects(
    getTrustedItems([{ productId: FRAME, quantity: 1, customPhotos: [photo('a')] }], '64b000000000000000000009'),
    /not valid/
  );
});

test('normal product ignores any photos sent with it', async () => {
  const out = await getTrustedItems([{ productId: VASE, quantity: 1, customPhotos: [photo('a')] }], U);

  assert.strictEqual(out[0].customPhotos, undefined);
});
