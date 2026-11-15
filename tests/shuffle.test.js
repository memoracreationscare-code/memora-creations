'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const read = p => fs.readFileSync(p, 'utf8');

test('shuffle is admin-controlled and on by default', () => {
  assert.ok(read('backend/services/settingsService.js').includes('shuffleProducts: true'));
  assert.ok(read('backend/models/SiteSettings.js').includes('shuffleProducts: Boolean'));
  assert.ok(read('backend/controllers/adminSettingsController.js').includes("'shuffleProducts'"));
  assert.ok(read('backend/routes/settingsRoutes.js').includes('shuffleProducts: s.shuffleProducts !== false'));
  assert.ok(read('admin/js/settings.js').includes("'shuffleProducts'"));
  assert.ok(read('admin/settings.html').includes('id="shuffleProducts"'));
});

test('shuffleProducts keeps every product, out-of-stock last, and respects OFF', async () => {
  const src = read('frontend/js/app.js');
  const fn = src.match(/async function shuffleProducts[\s\S]*?\n}\n/)[0];
  const make = st => new Function('window', fn + '; return shuffleProducts;')({ __mcSettings: Promise.resolve(st) });
  const list = [1, 2, 3, 4, 5, 6].map(i => ({ _id: i, stock: i === 3 ? 0 : 5 }));
  const out = await make({})(list);
  assert.equal(out.length, 6);
  assert.deepEqual(out.map(p => p._id).sort(), [1, 2, 3, 4, 5, 6]);
  assert.equal(out[5]._id, 3);
  assert.equal(await make({ shuffleProducts: false })(list), list);
});
