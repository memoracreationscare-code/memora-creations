'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('share + WhatsApp-order switches exist end to end (defaults, schema, admin save, public, admin page)', () => {
  assert.match(read('backend/services/settingsService.js'), /shareEnabled: true[\s\S]*waOrderEnabled: true/);
  assert.match(read('backend/models/SiteSettings.js'), /shareEnabled: Boolean[\s\S]*waOrderEnabled: Boolean[\s\S]*waOrderText: str\(300\)/);
  assert.match(read('backend/controllers/adminSettingsController.js'), /'shareEnabled', 'waOrderEnabled'/);
  assert.match(read('backend/controllers/adminSettingsController.js'), /waOrderText: 300/);
  assert.match(read('backend/routes/settingsRoutes.js'), /shareEnabled: s\.shareEnabled !== false/);
  assert.match(read('backend/routes/settingsRoutes.js'), /waOrderEnabled: s\.waOrderEnabled !== false/);
  const js = read('admin/js/settings.js');
  assert.match(js, /'shareEnabled', 'waOrderEnabled'/);
  assert.match(js, /'waOrderText'/);
  const html = read('admin/settings.html');
  for (const id of ['shareEnabled', 'waOrderEnabled', 'waOrderText']) assert.ok(html.includes('id="' + id + '"'), id);
});

test('single-column product layouts can shrink (no phone wider than its screen)', () => {
  const product = read('frontend/product.html');
  assert.match(product, /grid-template-columns:\s*minmax\(0,\s*1fr\);\s*gap:\s*26px/);
  assert.match(product, /#product > \.two > \*\s*\{\s*min-width:\s*0/);
  assert.match(read('frontend/js/app.js'), /\.product-popup\{grid-template-columns:minmax\(0,1fr\)/);
});

test('popups on home and products page both carry share, WhatsApp order and details link', () => {
  for (const f of ['frontend/index.html', 'frontend/js/products.js']) {
    const s = read(f);
    assert.ok(s.includes('mc-pop-share'), f);
    assert.ok(s.includes('data-wa-order'), f);
    assert.ok(s.includes('Poori details dekho'), f);
  }
});

test('every page loads the same app.js version (stale phone caches get refreshed)', () => {
  const versions = new Set();
  for (const f of fs.readdirSync(path.join(__dirname, '..', 'frontend')).filter(n => n.endsWith('.html'))) {
    const m = read('frontend/' + f).match(/\/frontend\/js\/app\.js\?v=(\d+)/);
    if (m) versions.add(m[1]);
  }
  assert.strictEqual(versions.size, 1);
});
