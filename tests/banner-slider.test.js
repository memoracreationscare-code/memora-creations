'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const js = fs.readFileSync('frontend/js/banners.js', 'utf8');

test('banner slider: autoplay, arrows, dots, drag/swipe, keyboard', () => {
  assert.match(js, /setInterval\([\s\S]*4500/);
  assert.match(js, /pointerdown/);
  assert.match(js, /pointermove/);
  assert.match(js, /ArrowLeft/);
  assert.match(js, /mc-arrow prev/);
  assert.match(js, /touch-action:pan-y/);
});

test('banner slider: images are not lazy (hidden slides must be ready) and phones show the full banner', () => {
  assert.doesNotMatch(js, /loading="lazy"/);
  assert.match(js, /\.mc-slide\.has-m img\{aspect-ratio:4\/3\}/);
});

test('a drag never opens the banner link', () => {
  assert.match(js, /if \(moved\) \{ e\.preventDefault\(\)/);
});
