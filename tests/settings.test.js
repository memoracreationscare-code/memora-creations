'use strict';

const test = require('node:test');
const assert = require('node:assert');
const settings = require('../backend/services/settingsService');

test('defaults use Render values when nothing is saved', () => {
  process.env.DELIVERY_CHARGE = '60';
  settings.setStored({});
  assert.strictEqual(settings.peek().deliveryCharge, 60);
  delete process.env.DELIVERY_CHARGE;
  assert.strictEqual(settings.peek().deliveryCharge, 49);
  assert.strictEqual(settings.peek().storeOpen, true);
});

test('saved values win over defaults, even false and 0', () => {
  settings.setStored({ storeOpen: false, freeDeliveryAbove: 0, codEnabled: false, phone: '' });
  const s = settings.peek();
  assert.strictEqual(s.storeOpen, false);
  assert.strictEqual(s.codEnabled, false);
  assert.strictEqual(s.freeDeliveryAbove, 0);
  settings.setStored({});
});

test('store closed raises the error with the message', () => {
  settings.setStored({ storeOpen: false, storeClosedMessage: 'Back on Monday' });
  let caught;
  try { settings.assertStoreOpen((code, msg) => Object.assign(new Error(msg), { code })); } catch (e) { caught = e; }
  assert.strictEqual(caught.message, 'Back on Monday');
  assert.strictEqual(caught.code, 503);
  settings.setStored({});
});

test('COD advance and return window follow the saved settings', () => {
  settings.setStored({ codAdvanceEnabled: true, codAdvancePercent: 40, returnWindowDays: 10 });
  assert.strictEqual(require('../backend/utils/codAdvance').isEnabled(), true);
  assert.strictEqual(require('../backend/utils/codAdvance').percent(), 40);
  assert.strictEqual(require('../backend/utils/returnRequests').windowDays(), 10);
  settings.setStored({});
});

test('admin input is cleaned and bad values are refused', () => {
  const path = require('node:path');
  const file = require.resolve(path.join(__dirname, '..', 'backend/models/SiteSettings.js'));
  require.cache[file] = { id: file, filename: file, loaded: true, exports: {} };
  const { clean } = require('../backend/controllers/adminSettingsController');

  const ok = clean({ whatsapp: '88740 50204', deliveryCharge: '59', codEnabled: true, storeOpen: false, instagram: 'https://instagram.com/memora' });
  assert.strictEqual(ok.whatsapp, '918874050204');
  assert.strictEqual(ok.deliveryCharge, 59);
  assert.strictEqual(ok.storeOpen, false);

  assert.throws(() => clean({ whatsapp: '123' }), /WhatsApp/);
  assert.throws(() => clean({ deliveryCharge: -5 }), /Delivery charge/);
  assert.throws(() => clean({ codAdvancePercent: 99 }), /between/);
  assert.throws(() => clean({ instagram: 'javascript:alert(1)' }), /https/);
  assert.throws(() => clean({ email: 'bad' }), /Email/);
});
