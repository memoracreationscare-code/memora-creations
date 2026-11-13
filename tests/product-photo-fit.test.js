'use strict';

const test = require('node:test');
const assert = require('node:assert');
const Module = require('module');

// the controller only needs the cloudinary signer: stub it so no package is required
const realLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'cloudinary') {
    return { v2: { config() {}, utils: { api_sign_request: (p) => 'SIG:' + Object.keys(p).sort().join(',') } } };
  }
  if (request === 'validator') return {};
  return realLoad.call(this, request, ...rest);
};

const ctl = require('../backend/controllers/cloudinaryController');
Module._load = realLoad;

function call(body) {
  process.env.CLOUDINARY_CLOUD_NAME = 'c';
  process.env.CLOUDINARY_API_KEY = 'k';
  process.env.CLOUDINARY_API_SECRET = 's';
  return new Promise((resolve, reject) => {
    const res = { status() { return res; }, json: b => resolve(b) };
    ctl.signature({ body }, res, reject);
  });
}

test('product uploads are fitted into a square (nothing cropped) and the transformation is signed', async () => {
  const r = await call({ folder: 'memora-creations/products', fit: true });
  assert.strictEqual(r.transformation, ctl.FIT_PRODUCT);
  assert.match(ctl.FIT_PRODUCT, /c_lpad/);
  assert.match(ctl.FIT_PRODUCT, /w_1200,h_1200/);
  assert.match(r.signature, /transformation/);
});

test('other uploads (banners) are untouched and sign without a transformation', async () => {
  const r = await call({ folder: 'memora-creations/banners' });
  assert.strictEqual(r.transformation, null);
  assert.ok(!/transformation/.test(r.signature));
  const r2 = await call({ folder: 'memora-creations/banners', fit: true });
  assert.strictEqual(r2.transformation, null);
});
