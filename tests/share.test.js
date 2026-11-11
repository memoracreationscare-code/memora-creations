'use strict';

const test = require('node:test');
const assert = require('node:assert');
const Module = require('module');

const realLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === 'mongoose') return { isValidObjectId: () => true };
  if (req === '../models') return { Product: {} };
  return realLoad.call(this, req, ...rest);
};
const { sharePage } = require('../backend/controllers/shareController');
Module._load = realLoad;

const product = {
  _id: 'p1', name: 'Moon "Lamp" <b>', description: 'A glowing\nmoon lamp', sellingPrice: 999, originalPrice: 1499,
  images: [{ url: 'https://res.cloudinary.com/x/moon.jpg' }]
};

test('share page has preview tags, photo, price and sends people to the product', () => {
  const html = sharePage(product, 'https://site.example/frontend');
  assert.match(html, /property="og:image" content="https:\/\/res\.cloudinary\.com\/x\/moon\.jpg"/);
  assert.match(html, /og:title" content="Moon &quot;Lamp&quot; &lt;b&gt; - Memora Creations"/);
  assert.match(html, /Rs\. 999 \(MRP Rs\. 1,499\)/);
  assert.match(html, /url=https:\/\/site\.example\/frontend\/product\.html\?id=p1/);
  assert.ok(!html.includes('<b>'));
});

test('product without a photo still works', () => {
  assert.ok(!sharePage({ ...product, images: [] }, 'https://s.x').includes('og:image'));
});
