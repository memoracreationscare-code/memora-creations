'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const read = p => fs.readFileSync(p, 'utf8');

test('WhatsApp updates option is admin-controlled and off by default', () => {
  assert.match(read('backend/services/settingsService.js'), /waUpdatesEnabled: false/);
  assert.match(read('backend/models/SiteSettings.js'), /waUpdatesEnabled: Boolean/);
  assert.match(read('backend/controllers/adminSettingsController.js'), /'waUpdatesEnabled'/);
  assert.match(read('backend/routes/settingsRoutes.js'), /waUpdatesEnabled: s\.waUpdatesEnabled === true/);
  assert.match(read('admin/js/settings.js'), /'waUpdatesEnabled'/);
  assert.ok(read('admin/settings.html').includes('id="waUpdatesEnabled"'));
});

test('checkout enables the checkbox only when the setting is true', () => {
  const js = read('frontend/js/checkout.js');
  assert.match(js, /box\.disabled = s\.waUpdatesEnabled !== true/);
  assert.match(js, /catch \(_\) \{\s*box\.disabled = true/);
  assert.match(read('frontend/checkout.html'), /id="whatsappOptIn"[\s\S]{0,80}disabled/);
});
