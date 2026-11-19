'use strict';

const test = require('node:test');
const assert = require('node:assert');
const feed = require('../backend/services/productFeed');

const base = {
  _id: 'abc123',
  productId: 'MC-1',
  name: 'Gold & "Vase" 5 < 6',
  description: '<p>Nice   lamp</p>',
  images: [{ url: 'https://img/1.jpg' }, { url: 'https://img/2.jpg' }],
  category: 'Lamps',
  sellingPrice: 499,
  originalPrice: 699,
  stock: 3
};

test('product with sale shows full price plus sale price', () => {
  const i = feed.toItem(base);
  assert.strictEqual(i.price, '699.00 INR');
  assert.strictEqual(i.salePrice, '499.00 INR');
  assert.strictEqual(i.availability, 'in stock');
  assert.strictEqual(i.description, 'Nice lamp');
  assert.match(i.link, /product\.html\?id=abc123$/);
});

test('products without image, price or name are left out', () => {
  assert.strictEqual(feed.toItem({ ...base, images: [] }), null);
  assert.strictEqual(feed.toItem({ ...base, sellingPrice: 0 }), null);
  assert.strictEqual(feed.toItem({ ...base, name: '' }), null);
  assert.strictEqual(feed.toItem({ ...base, stock: 0 }).availability, 'out of stock');
});

test('xml is escaped and well formed', () => {
  const xml = feed.toXml([base, { ...base, images: [] }]);
  assert.ok(xml.includes('Gold &amp; &quot;Vase&quot; 5 &lt; 6'));
  assert.ok(!xml.includes('<script'));
  assert.strictEqual((xml.match(/<item>/g) || []).length, 1);
  assert.ok(xml.includes('<g:sale_price>499.00 INR</g:sale_price>'));
  assert.ok(xml.includes('<g:additional_image_link>https://img/2.jpg'));
});

test('csv quotes cells and blocks spreadsheet formulas', () => {
  const csv = feed.toCsv([{ ...base, name: '=HYPERLINK("x")' }]);
  const lines = csv.trim().split('\n');
  assert.strictEqual(lines.length, 2);
  assert.ok(lines[1].includes(`"'=HYPERLINK(""x"")"`));
});
