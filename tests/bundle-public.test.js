'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

// mongoose / express may be missing in a bare sandbox: stub only what is missing.
const stubs = {
  mongoose: { Types: { ObjectId: { isValid: v => /^[a-f0-9]{24}$/i.test(String(v)) } } }
};
const origResolve = Module._resolveFilename;
for (const name of Object.keys(stubs)) {
  try { require.resolve(name); } catch (_) {
    const file = path.join(__dirname, `${name}-stub-bp.js`);
    require.cache[file] = { id: file, filename: file, loaded: true, exports: stubs[name] };
    const prev = Module._resolveFilename;
    Module._resolveFilename = function (req, ...a) { return req === name ? file : prev.call(this, req, ...a); };
  }
}
let haveExpress = true;
try { require.resolve('express'); } catch (_) { haveExpress = false; }

const rows = [];
const modelsFile = require.resolve('../backend/models/index.js');
const chain = list => { const p = { populate: () => p, sort: () => p, limit: () => p, lean: async () => list }; return p; };
require.cache[modelsFile] = { id: modelsFile, filename: modelsFile, loaded: true, exports: { Bundle: { find: () => chain(rows) } } };

const call = async query => {
  const router = require('../backend/routes/bundleRoutes');
  const layer = router.stack.find(l => l.route && l.route.path === '/');
  const handler = layer.route.stack[0].handle;
  let out;
  await handler({ query }, { set() {}, status() { return this; }, json(b) { out = b; return this; } }, e => { throw e; });
  return out;
};

const P = (id, price, extra = {}) => ({ _id: id, name: 'P' + id, sellingPrice: price, isActive: true, stock: 5, images: [{ url: 'u' + id }], variants: [], ...extra });

test('public bundle endpoint', { skip: !haveExpress }, async () => {
  assert.deepStrictEqual((await call({ productId: 'bad' })).bundles, []);

  rows.push({ _id: 'b1', name: 'Combo', discountAmount: 100, products: [P('a'.repeat(24), 500), P('b'.repeat(24), 300)] });
  let r = await call({ productId: 'a'.repeat(24) });
  assert.strictEqual(r.bundles.length, 1);
  const b = r.bundles[0];
  assert.strictEqual(b.total, 800);
  assert.strictEqual(b.discount, 100);
  assert.strictEqual(b.payable, 700);
  assert.ok(b.items.every(i => i.needsChoice === false && i.inStock));

  rows[0].products[1] = P('b'.repeat(24), 300, { variants: [{ label: 'L' }] });
  r = await call({ productId: 'a'.repeat(24) });
  assert.strictEqual(r.bundles[0].items[1].needsChoice, true);

  rows[0].products[1] = P('b'.repeat(24), 300, { isActive: false });
  r = await call({ productId: 'a'.repeat(24) });
  assert.strictEqual(r.bundles.length, 0, 'a bundle with a hidden product is not shown');
});

test('product page and blog are wired to the new scripts', () => {
  const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  assert.match(read('frontend/product.html'), /bundle-box\.js/);
  assert.match(read('frontend/js/products.js'), /MCBundleBox\?\.mount/);
  assert.match(read('backend/server.js'), /\/api\/bundles/);
  for (const f of fs.readdirSync(path.join(__dirname, '..', 'frontend')).filter(x => /^blog-.+\.html$/.test(x))) {
    assert.match(read('frontend/' + f), /blog-products\.js/, f);
    assert.match(read('frontend/' + f), /class="bl-products" data-q=/, f);
  }
});
