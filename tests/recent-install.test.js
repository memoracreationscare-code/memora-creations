'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const read = p => fs.readFileSync(p, 'utf8');

test('recently viewed and install banner are admin-controlled', () => {
  for (const k of ['recentViewedEnabled', 'installAppEnabled']) {
    assert.ok(read('backend/services/settingsService.js').includes(k + ': true'));
    assert.ok(read('backend/models/SiteSettings.js').includes(k + ': Boolean'));
    assert.ok(read('backend/controllers/adminSettingsController.js').includes("'" + k + "'"));
    assert.ok(read('backend/routes/settingsRoutes.js').includes(k + ': s.' + k + ' !== false'));
    assert.ok(read('admin/js/settings.js').includes("'" + k + "'"));
    assert.ok(read('admin/settings.html').includes('id="' + k + '"'));
  }
});

test('manifest is valid and service worker caches nothing', () => {
  const m = JSON.parse(read('frontend/manifest.webmanifest'));
  assert.equal(m.display, 'standalone');
  assert.ok(m.icons.some(i => i.sizes === '512x512'));
  assert.ok(fs.existsSync('frontend/images/icon-512.png'));
  assert.doesNotMatch(read('frontend/sw.js'), /caches\.|cache\.put|addAll/);
});

test('recent.js stores only product ids', () => {
  const js = read('frontend/js/recent.js');
  assert.match(js, /\[a-f0-9\]\{24\}/);
  assert.match(js, /write\(\[id\]/);
});
