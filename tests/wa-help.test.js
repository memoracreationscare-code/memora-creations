'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('WhatsApp help links get a structured message built at click time', () => {
  const js = read('frontend/js/extras.js');
  assert.match(js, /a\[href\*="wa\.me\/"\]/);
  assert.match(js, /Namaste Memora Creations!\*/);
  assert.match(js, /Kripya meri madad karein/);
  // share links without a number and custom messages are left alone
  assert.match(js, /\\d\{10,15\}/);
});

test('the product order message keeps an admin-written text', () => {
  const js = read('frontend/js/share.js');
  assert.match(js, /const custom = String\(settings\.waOrderText/);
  assert.match(js, /Kya ye available hai\?/);
});

test('every page that loads extras.js uses the same new version', () => {
  const dir = path.join(__dirname, '..', 'frontend');
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.html'))) {
    const h = fs.readFileSync(path.join(dir, f), 'utf8');
    if (h.includes('extras.js')) assert.match(h, /extras\.js\?v=11/, f);
  }
});
