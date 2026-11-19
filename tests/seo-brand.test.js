'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const page = n => fs.readFileSync(path.join(__dirname, '../frontend', n), 'utf8');

test('public page titles say what the shop sells', () => {
  for (const n of ['index.html', 'products.html', 'about.html', 'contact.html']) {
    const title = page(n).match(/<title>([^<]*)<\/title>/)[1];
    assert.match(title, /Home Decor &amp; Gifts/, n);
    assert.match(title, /Memora Creations/, n);
    assert.ok(title.length <= 70, n + ' title too long');
  }
});

test('home page structured data is valid JSON with store + website', () => {
  const m = page('index.html').match(/application\/ld\+json">([\s\S]*?)<\/script>/);
  const d = JSON.parse(m[1]);
  const types = d['@graph'].map(x => x['@type']);

  assert.deepStrictEqual(types, ['Store', 'WebSite']);
  assert.match(d['@graph'][0].description, /home decor and gifts/i);
  assert.match(d['@graph'][1].potentialAction.target, /products\.html\?q=\{search_term_string\}/);
});
