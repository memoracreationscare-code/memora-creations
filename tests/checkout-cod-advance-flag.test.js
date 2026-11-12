'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'js', 'checkout.js'), 'utf8');

test('create-order request carries the COD advance flag', () => {
  const start = src.indexOf("'/cashfree/create-order'");
  assert.ok(start > 0);
  const chunk = src.slice(start, start + 400);
  assert.match(chunk, /codAdvance:\s*true/);
});

test('every use of advanceMode is inside the function that defines it', () => {
  const def = src.indexOf('const advanceMode');
  const firstUse = src.indexOf('advanceMode');
  assert.strictEqual(def, firstUse, 'advanceMode used before/outside its definition');
  const codFn = src.indexOf('async function placeCodOrder');
  const cfFn = src.indexOf('async function placeCashfreeOrder');
  const codBody = src.slice(codFn, cfFn);
  assert.ok(!codBody.includes('advanceMode'));
});
