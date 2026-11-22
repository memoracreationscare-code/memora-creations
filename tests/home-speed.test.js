'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'frontend/index.html'), 'utf8');

test('hero photo is preloaded with high priority and the file exists', () => {
  assert.match(html, /<link rel="preload" as="image" href="\/frontend\/images\/hero-decor\.webp"[^>]*fetchpriority="high">/);
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'frontend/images/hero-decor.webp')));
});

test('home product cards use right-sized srcset for Cloudinary photos only', () => {
  assert.match(html, /\[320, 480, 640\]\.map\(w => `\$\{window\.MC\.optImg\(rawImage, w\)\} \$\{w\}w`\)/);
  assert.match(html, /srcset="\$\{esc\(srcset\)\}" sizes=/);
  assert.match(html, /: ''/);
});

test('optImg gives smaller files for smaller widths and leaves other URLs alone', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'frontend/js/app.js'), 'utf8');
  const m = src.match(/function optImg\(url, width\) \{[\s\S]*?\n\}/);
  const optImg = new Function(m[0] + '; return optImg;')();
  const u = 'https://res.cloudinary.com/demo/image/upload/v1/a.jpg';
  assert.match(optImg(u, 320), /w_320\//);
  assert.match(optImg(u, 640), /w_640\//);
  assert.strictEqual(optImg('https://example.com/a.jpg', 320), 'https://example.com/a.jpg');
});
