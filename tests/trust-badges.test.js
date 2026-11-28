const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');

test('trust badges: admin switch wired end to end', () => {
  for (const f of ['backend/services/settingsService.js', 'backend/models/SiteSettings.js', 'backend/controllers/adminSettingsController.js', 'backend/routes/settingsRoutes.js', 'admin/js/settings.js', 'admin/settings.html']) {
    assert.ok(fs.readFileSync(f, 'utf8').includes('trustBadgesEnabled'), f);
  }
  assert.ok(fs.readFileSync('frontend/product.html', 'utf8').includes('trust-badges.js'));
});

test('trust badges script uses live return days and textContent only', () => {
  const s = fs.readFileSync('frontend/js/trust-badges.js', 'utf8');
  assert.match(s, /returnWindowDays/);
  assert.match(s, /trustBadgesEnabled === false/);
  assert.ok(!/innerHTML/.test(s));
});
