'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('products page folds filters on phones only and never hides them without JS', () => {
  const js = read('frontend/js/filter-toggle.js');
  assert.match(js, /@media \(max-width:700px\)/);
  assert.match(js, /is-folded/);
  // the folding rule lives inside the phone media query, so desktop is untouched
  assert.ok(js.indexOf('.is-folded') > js.indexOf('@media'));
  assert.match(read('frontend/products.html'), /filter-toggle\.js\?v=1/);
});

test('reviews show a friendly empty state instead of 0.0', () => {
  assert.match(read('frontend/js/reviews.js'), /total === 0 \?/);
  assert.match(read('frontend/product.html'), /reviews\.js\?v=3/);
});
