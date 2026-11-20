'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('policies page links to all four policies', () => {
  const h = read('frontend/policies.html');
  for (const f of ['shipping-policy', 'return-refund-policy', 'privacy-policy', 'terms']) {
    assert.ok(h.includes(`href="/frontend/${f}.html"`), f);
    assert.ok(fs.existsSync(path.join(__dirname, '..', `frontend/${f}.html`)), f);
  }
  assert.match(h, /rel="canonical" href="https:\/\/memoracreationscare\.in\/frontend\/policies\.html"/);
});

test('home page no longer lists the policies column; profile links to the page', () => {
  const home = read('frontend/index.html');
  assert.doesNotMatch(home, /footer-title">Customer Policies/);
  assert.match(home, /href="\/frontend\/policies\.html">Policies</);
  assert.match(read('frontend/profile.html'), /class="profile-policies-link" href="\/frontend\/policies\.html"/);
});

test('sitemap knows the policies page', () => {
  assert.match(read('sitemap.xml'), /frontend\/policies\.html/);
  assert.match(read('scripts/build-sitemap.js'), /'policies\.html'/);
});
