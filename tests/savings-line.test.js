const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

test('savings line comes only from real original vs selling price', () => {
  const s = fs.readFileSync('frontend/js/products.js', 'utf8');
  assert.match(s, /function saveLine/);
  assert.match(s, /save > 0 && Number\(product\.sellingPrice\) > 0/);
  assert.match(s, /priceMarkup\(product, undefined, true\)/);
});
