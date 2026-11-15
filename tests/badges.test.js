'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const read = p => fs.readFileSync(p, 'utf8');

test('Bestseller/New tags are admin-controlled', () => {
  assert.ok(read('backend/services/settingsService.js').includes('badgesEnabled: true'));
  assert.ok(read('backend/models/SiteSettings.js').includes('badgesEnabled: Boolean'));
  assert.ok(read('backend/controllers/adminSettingsController.js').includes("'badgesEnabled'"));
  assert.ok(read('backend/routes/settingsRoutes.js').includes('badgesEnabled: s.badgesEnabled !== false'));
  assert.ok(read('admin/js/settings.js').includes("'badgesEnabled'"));
  assert.ok(read('admin/settings.html').includes('id="badgesEnabled"'));
});

test('ribbon: Bestseller flag wins, New only for products under 14 days old', () => {
  const src = read('frontend/js/app.js');
  const fn = src.match(/const NEW_DAYS[\s\S]*?\n}\n/)[0];
  const ribbonHtml = new Function(fn + '; return ribbonHtml;')();
  const day = 864e5;
  assert.match(ribbonHtml({ isBestSeller: true, createdAt: new Date().toISOString() }), /Bestseller/);
  assert.match(ribbonHtml({ createdAt: new Date(Date.now() - 3 * day).toISOString() }), />New</);
  assert.equal(ribbonHtml({ createdAt: new Date(Date.now() - 40 * day).toISOString() }), '');
  assert.equal(ribbonHtml({}), '');
  assert.equal(ribbonHtml(null), '');
});
