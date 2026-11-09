'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { extractPaymentDetails, pickSuccessfulPayment } = require('../backend/utils/paymentDetails');

test('UPI payment keeps UPI id and UTR', () => {
  const d = extractPaymentDetails({
    cf_payment_id: 123, payment_status: 'SUCCESS', payment_amount: 499,
    payment_group: 'upi', bank_reference: '312345678901',
    payment_completion_time: '2026-11-09T10:00:00+05:30',
    payment_method: { upi: { channel: 'collect', upi_id: 'ram@okhdfc' } }
  });
  assert.strictEqual(d.method, 'UPI');
  assert.strictEqual(d.upiId, 'ram@okhdfc');
  assert.strictEqual(d.bankReference, '312345678901');
  assert.strictEqual(d.cfPaymentId, '123');
  assert.strictEqual(d.amount, 499);
});

test('card keeps only last 4 digits', () => {
  const d = extractPaymentDetails({
    payment_group: 'credit_card',
    payment_method: { card: { card_number: 'XXXXXXXX1234', card_network: 'visa', card_bank_name: 'HDFC' } }
  });
  assert.strictEqual(d.cardLast4, '1234');
  assert.ok(!JSON.stringify(d).includes('XXXXXXXX'));
});

test('picks the successful attempt, ignores failed', () => {
  const p = pickSuccessfulPayment([
    { cf_payment_id: 1, payment_status: 'FAILED' },
    { cf_payment_id: 2, payment_status: 'SUCCESS' }
  ]);
  assert.strictEqual(p.cf_payment_id, 2);
  assert.strictEqual(pickSuccessfulPayment([]), null);
  assert.strictEqual(extractPaymentDetails(null), null);
});
