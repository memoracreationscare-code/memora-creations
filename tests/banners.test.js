'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const file = require.resolve(path.join(__dirname, '..', 'backend/models/Banner.js'));
require.cache[file] = { id: file, filename: file, loaded: true, exports: {} };
const mongooseFile = path.join(__dirname, '..', 'node_modules', 'mongoose');
const Module = require('node:module');
const realLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'mongoose') return { isValidObjectId: () => true };
  return realLoad.call(this, request, ...rest);
};

const { clean } = require('../backend/controllers/bannerController');

test('a banner needs an https image', () => {
  assert.throws(() => clean({}), /upload a banner image/);
  assert.throws(() => clean({ imageUrl: 'javascript:alert(1)' }), /upload a banner image/);
  assert.strictEqual(clean({ imageUrl: 'https://res.cloudinary.com/x/a.jpg', title: ' Sale ' }).title, 'Sale');
});

test('links must be shop pages or https, never script', () => {
  const img = 'https://res.cloudinary.com/x/a.jpg';
  assert.strictEqual(clean({ imageUrl: img, link: 'products.html' }).link, 'products.html');
  assert.strictEqual(clean({ imageUrl: img, link: 'https://example.com/a' }).link, 'https://example.com/a');
  assert.throws(() => clean({ imageUrl: img, link: 'javascript:alert(1)' }), /Link must/);
  assert.throws(() => clean({ imageUrl: img, link: 'http://x.com' }), /Link must/);
});

test('partial update keeps image untouched and validates dates', () => {
  const out = clean({ active: false, sortOrder: '3' }, true);
  assert.deepStrictEqual(out, { active: false, sortOrder: 3 });
  assert.throws(() => clean({ startsAt: 'nope' }, true), /Date/);
});
