'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const src = fs.readFileSync('frontend/js/app.js', 'utf8');
const fn = src.match(/function optImg[\s\S]*?\n}\n/)[0];
const optImg = new Function(fn + '; return optImg;')();

test('Cloudinary photos get a right-sized modern-format URL', () => {
  const u = 'https://res.cloudinary.com/demo/image/upload/v123/memora/a.jpg';
  assert.equal(optImg(u, 560), 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_560/v123/memora/a.jpg');
});

test('already-transformed, foreign and empty URLs are left alone', () => {
  const t = 'https://res.cloudinary.com/demo/image/upload/w_300,c_fill/v1/a.jpg';
  assert.equal(optImg(t, 560), t);
  assert.equal(optImg('https://placehold.co/600x600?text=Memora', 560), 'https://placehold.co/600x600?text=Memora');
  assert.equal(optImg(undefined, 560), undefined);
  assert.equal(optImg('', 560), '');
});

test('home page title/description are keyword-rich', () => {
  const h = fs.readFileSync('frontend/index.html', 'utf8');
  assert.match(h, /<title>Memora Creations \| Home Decor, Photo Frames & Personalized Gifts Online<\/title>/);
  assert.match(h, /name="description" content="Shop home decor, personalized photo frames/);
});
