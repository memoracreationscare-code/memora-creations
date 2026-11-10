'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { findVariant, hasVariants, virtualProduct, cleanVariants } = require('../backend/utils/variants');

const product = {
  _id: 'p1', name: 'Wall Frame', sellingPrice: 500, originalPrice: 700, stock: 8,
  variants: [
    { _id: 'v1', label: 'Small', stock: 5 },
    { _id: 'v2', label: 'Large', price: 800, originalPrice: 1000, stock: 3 }
  ]
};

test('variant lookup and detection', () => {
  assert.ok(hasVariants(product));
  assert.ok(!hasVariants({ variants: [] }));
  assert.strictEqual(findVariant(product, 'v2').label, 'Large');
  assert.strictEqual(findVariant(product, 'nope'), null);
  assert.strictEqual(findVariant(product, undefined), null);
});

test('virtual product carries the option name, price and stock', () => {
  const small = virtualProduct(product, product.variants[0]);
  assert.strictEqual(small.name, 'Wall Frame (Small)');
  assert.strictEqual(small.sellingPrice, 500); // falls back to product price
  assert.strictEqual(small.stock, 5);
  const large = virtualProduct(product, product.variants[1]);
  assert.strictEqual(large.sellingPrice, 800);
  assert.strictEqual(large.originalPrice, 1000);
  assert.strictEqual(large.variantId, 'v2');
});

test('admin input is cleaned and checked', () => {
  assert.strictEqual(cleanVariants(undefined), undefined);
  assert.deepStrictEqual(cleanVariants([{ label: ' Red ', stock: '4', price: '' }]), [{ label: 'Red', stock: 4 }]);
  assert.throws(() => cleanVariants([{ label: '', stock: 1 }]), /needs a name/);
  assert.throws(() => cleanVariants([{ label: 'A', stock: 1 }, { label: 'a', stock: 2 }]), /repeated/);
  assert.throws(() => cleanVariants([{ label: 'A', stock: -1 }]), /whole number/);
  assert.throws(() => cleanVariants([{ label: 'A', stock: 1, price: 9, originalPrice: 5 }]), /more than its MRP/);
  assert.deepStrictEqual(cleanVariants([]), []);
});
