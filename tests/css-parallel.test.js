'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', 'frontend');
const pages = fs.readdirSync(root).filter(f => f.endsWith('.html'));

test('style.css no longer @imports the navbar (that made a slow chain)', () => {
  assert.ok(!/@import/.test(fs.readFileSync(path.join(root, 'css/style.css'), 'utf8')));
});

test('every page that uses style.css loads the navbar CSS right before it', () => {
  let checked = 0;
  for (const f of pages) {
    const html = fs.readFileSync(path.join(root, f), 'utf8');
    if (!/css\/style\.css/.test(html)) continue;
    checked += 1;
    const nav = html.indexOf('css/premium-navbar.css');
    const style = html.indexOf('css/style.css');
    assert.ok(nav > -1 && nav < style, `${f}: navbar css must come before style.css`);
    assert.ok(/style\.css\?v=16/.test(html), `${f}: style.css version`);
  }
  assert.ok(checked >= 29);
});
