'use strict';

const test = require('node:test');
const assert = require('node:assert');

const rules = require('../backend/utils/codAdvance');
const { codFigures, shiprocketPaymentMethod } = require('../backend/services/shiprocketService');

test('30% split is exact to the paisa', () => {
  assert.deepStrictEqual(rules.splitAdvance(1000, 30), { percent: 30, advanceAmount: 300, balanceAmount: 700 });
  const s = rules.splitAdvance(1047, 30);
  assert.strictEqual(s.advanceAmount, 314.1);
  assert.strictEqual(Math.round((s.advanceAmount + s.balanceAmount) * 100), 104700);
  const odd = rules.splitAdvance(333.33, 30);
  assert.strictEqual(Math.round((odd.advanceAmount + odd.balanceAmount) * 100), 33333);
});

test('tiny orders cannot be split and the advance is at least Rs 1', () => {
  assert.strictEqual(rules.splitAdvance(1.5, 30), null);
  assert.strictEqual(rules.splitAdvance(5, 5).advanceAmount, 1);
  assert.strictEqual(rules.splitAdvance(5, 90).balanceAmount, 1);
});

test('feature is off unless switched on, percent is clamped', () => {
  delete process.env.COD_ADVANCE_ENABLED;
  assert.strictEqual(rules.isEnabled(), false);
  process.env.COD_ADVANCE_ENABLED = 'true';
  assert.strictEqual(rules.isEnabled(), true);
  process.env.COD_ADVANCE_PERCENT = '1';
  assert.strictEqual(rules.percent(), 5);
  process.env.COD_ADVANCE_PERCENT = '99';
  assert.strictEqual(rules.percent(), 90);
  process.env.COD_ADVANCE_PERCENT = 'abc';
  assert.strictEqual(rules.percent(), 30);
  delete process.env.COD_ADVANCE_ENABLED;
  delete process.env.COD_ADVANCE_PERCENT;
});

test('normal orders behave exactly as before', () => {
  const online = { paymentMethod: 'CASHFREE', grandTotal: 500 };
  const cod = { paymentMethod: 'COD', grandTotal: 500 };
  assert.strictEqual(rules.onlineAmount(online), 500);
  assert.strictEqual(rules.onlineAmount({ ...online, codAdvance: { enabled: false } }), 500);
  assert.strictEqual(rules.cashOnDelivery(online), 0);
  assert.strictEqual(rules.cashOnDelivery(cod), 500);
});

test('advance orders: gateway takes the advance, courier the balance', () => {
  const order = { paymentMethod: 'CASHFREE', grandTotal: 1000, codAdvance: { enabled: true, advanceAmount: 300, balanceAmount: 700 } };
  assert.strictEqual(rules.onlineAmount(order), 300);
  assert.strictEqual(rules.cashOnDelivery(order), 700);
});

test('Shiprocket collects exactly the cash due', () => {
  const advance = {
    paymentMethod: 'CASHFREE', subtotal: 900, deliveryCharge: 49, discount: 200,
    giftWrapping: { selected: true, fee: 51 }, grandTotal: 1000,
    codAdvance: { enabled: true, advanceAmount: 300, balanceAmount: 700 }
  };
  const f = codFigures(advance);
  assert.strictEqual(shiprocketPaymentMethod(advance), 'COD');
  assert.strictEqual(900 + 49 + f.giftwrap - f.discount, 700);

  const plainCod = { paymentMethod: 'COD', subtotal: 900, deliveryCharge: 49, discount: 200, giftWrapping: { selected: false }, grandTotal: 949 };
  const g = codFigures(plainCod);
  assert.strictEqual(900 + 49 + g.giftwrap - g.discount, 949);

  const prepaid = { paymentMethod: 'CASHFREE', subtotal: 900, deliveryCharge: 49, discount: 200, grandTotal: 949 };
  assert.strictEqual(shiprocketPaymentMethod(prepaid), 'Prepaid');
  assert.deepStrictEqual(codFigures(prepaid), { giftwrap: 0, discount: 200 });
});
