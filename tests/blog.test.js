'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const posts = fs.readdirSync(path.join(root, 'frontend')).filter(f => /^blog-.+\.html$/.test(f));

test('blog index and at least four articles exist', () => {
  assert.ok(fs.existsSync(path.join(root, 'frontend/blog.html')));
  assert.ok(posts.length >= 4);
});

test('every article is complete for search engines', () => {
  for (const f of posts) {
    const h = read('frontend/' + f);
    assert.match(h, /<title>[^<]{20,}<\/title>/, f);
    assert.match(h, /<meta name="description" content="[^"]{60,200}"/, f);
    assert.match(h, new RegExp(`rel="canonical" href="https://memoracreationscare.in/frontend/${f}"`), f);
    assert.match(h, /"@type": "Article"/, f);
    assert.equal((h.match(/<h1>/g) || []).length, 1, f);
    assert.match(h, /href="\/frontend\/products\.html\?q=/, f); // links to the shop
    assert.match(h, /app\.js\?v=37/, f);
    assert.doesNotMatch(h, /\{[a-z]+\}/, f); // no unfilled template placeholder
  }
});

test('index lists every article, sitemap and footer link to the blog', () => {
  const idx = read('frontend/blog.html');
  const map = read('sitemap.xml');
  for (const f of posts) {
    assert.ok(idx.includes('/frontend/' + f), f);
    assert.ok(map.includes('/frontend/' + f), 'sitemap.xml ' + f);
    assert.ok(read('scripts/build-sitemap.js').includes(`'${f}'`), 'build-sitemap ' + f);
  }
  assert.ok(map.includes('/frontend/blog.html'));
  assert.match(read('frontend/index.html'), /href="\/frontend\/blog\.html">Decor Ideas/);
});
