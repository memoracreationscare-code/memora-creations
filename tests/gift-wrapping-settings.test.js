'use strict';

const test = require('node:test');
const assert = require('node:assert');

const settings = require('../backend/services/settingsService');
const gift = require('../backend/services/giftWrappingService');

test('gift wrapping is controlled from Store Settings and defaults to off', () => {
  settings.setStored({});
  assert.strictEqual(gift.isGiftWrappingEnabled(), false);
  assert.throws(() => gift.prepareGiftWrapping({ selected: true, type: 'STANDARD' }), /not available/);
  assert.deepStrictEqual(gift.prepareGiftWrapping(null), { selected: false, type: 'NONE', fee: 0, message: '' });
});

test('when switched on, the owner prices are used (never the browser)', () => {
  settings.setStored({ giftWrapEnabled: true, giftWrapStandardFee: 40, giftWrapPremiumFee: 99 });
  assert.strictEqual(gift.isGiftWrappingEnabled(), true);
  assert.deepStrictEqual(gift.giftWrappingPrices(), { NONE: 0, STANDARD: 40, PREMIUM: 99 });

  const g = gift.prepareGiftWrapping({ selected: true, type: 'PREMIUM', fee: 1, message: ' Happy Birthday ' });
  assert.strictEqual(g.fee, 99);
  assert.strictEqual(g.message, 'Happy Birthday');
});

test('message limit and bad type are rejected', () => {
  settings.setStored({ giftWrapEnabled: true });
  assert.throws(() => gift.prepareGiftWrapping({ selected: true, type: 'STANDARD', message: 'x'.repeat(181) }), /exceed/);
  assert.throws(() => gift.prepareGiftWrapping({ selected: true, type: 'GOLD' }), /Invalid/);
  assert.throws(() => gift.prepareGiftWrapping({ selected: true, type: 'NONE' }), /select/);
});

test.after(() => settings.setStored({}));
