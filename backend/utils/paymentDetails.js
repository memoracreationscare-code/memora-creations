'use strict';

/*
  Turns a Cashfree payment object (from the webhook or from
  GET /orders/{id}/payments) into the small record the admin sees.
  Only safe fields are kept: UPI ID, bank reference (UTR), method,
  bank name and the LAST 4 digits of a card. Never a full card number.
*/

const GROUP_LABEL = {
  upi: 'UPI',
  credit_card: 'Credit card',
  debit_card: 'Debit card',
  net_banking: 'Net banking',
  netbanking: 'Net banking',
  wallet: 'Wallet',
  app: 'Wallet / app',
  paylater: 'Pay later',
  cardless_emi: 'Cardless EMI',
  emi: 'EMI'
};

function text(value, max = 120) {
  if (value === undefined || value === null) return '';

  return String(value).trim().slice(0, max);
}

function extractPaymentDetails(payment) {
  if (!payment || typeof payment !== 'object') return null;

  const method = payment.payment_method || {};
  const group = text(payment.payment_group).toLowerCase();

  const upi = method.upi || {};
  const card = method.card || {};
  const bank = method.netbanking || {};
  const app = method.app || {};

  const cardNumber = text(card.card_number, 40).replace(/\D/g, '');

  return {
    cfPaymentId: text(payment.cf_payment_id),
    method: GROUP_LABEL[group] || (group ? group : (
      method.upi ? 'UPI' : method.card ? 'Card' : method.netbanking ? 'Net banking' : ''
    )),
    upiId: text(upi.upi_id),
    upiChannel: text(upi.channel, 30),
    bankReference: text(payment.bank_reference),
    bankName: text(card.card_bank_name || bank.netbanking_bank_name),
    cardNetwork: text(card.card_network, 30),
    cardLast4: cardNumber.slice(-4),
    appProvider: text(app.provider, 40),
    amount: Number.isFinite(Number(payment.payment_amount))
      ? Number(payment.payment_amount)
      : undefined,
    paidAt: payment.payment_completion_time || payment.payment_time
      ? new Date(payment.payment_completion_time || payment.payment_time)
      : undefined
  };
}

// Picks the successful attempt (latest first) from a payments list.
function pickSuccessfulPayment(payments) {
  const list = Array.isArray(payments) ? payments : [];

  return list
    .filter(p => p && p.payment_status === 'SUCCESS')
    .sort((a, b) =>
      new Date(b.payment_completion_time || b.payment_time || 0) -
      new Date(a.payment_completion_time || a.payment_time || 0)
    )[0] || null;
}

module.exports = { extractPaymentDetails, pickSuccessfulPayment };
