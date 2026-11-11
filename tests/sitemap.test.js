'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { buildSitemap, fetchAllProducts } = require('../scripts/build-sitemap');

test('sitemap lists fixed pages and every product, escaped', () => {
  const xml = buildSitemap([{ _id: 'abc123', updatedAt: '2026-11-10T08:00:00Z' }, { _id: 'x&y' }, null], '2026-11-12');
  assert.match(xml, /product\.html\?id=abc123<\/loc>\s*<lastmod>2026-11-10/);
  assert.match(xml, /id=x%26y/);
  assert.match(xml, /frontend\/index\.html/);
  assert.strictEqual((xml.match(/<url>/g) || []).length, 8 + 2);
});

test('all pages of products are read', async () => {
  const pages = { 1: { products: [{ _id: 1 }, { _id: 2 }], pagination: { pages: 2 } }, 2: { products: [{ _id: 3 }], pagination: { pages: 2 } } };
  const got = await fetchAllProducts(async url => pages[new URL(url).searchParams.get('page')]);
  assert.deepStrictEqual(got.map(p => p._id), [1, 2, 3]);
});
