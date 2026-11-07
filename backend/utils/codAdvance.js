'use strict';

/*
  COD WITH ADVANCE PAYMENT

  When switched on, a customer who chooses Cash on Delivery first pays
  a part of the total online (30% by default) through Cashfree and
  pays the rest to the courier on delivery.

  Switch on in Render:   COD_ADVANCE_ENABLED=true
  Change the share:      COD_ADVANCE_PERCENT=30   (5 to 90)

  Such an order is stored as a normal Cashfree order whose gateway
  amount is only the advance, plus a `codAdvance` block:
    { enabled, percent, advanceAmount, balanceAmount, balanceStatus }
*/

function isEnabled() {
  return String(process.env.COD_ADVANCE_ENABLED || '').toLowerCase() === 'true';
}

function percent() {
  const value = Number(process.env.COD_ADVANCE_PERCENT || 30);

  if (!Number.isFinite(value)) return 30;

  return Math.min(90, Math.max(5, Math.round(value)));
}

const paise = value => Math.round(Number(value || 0) * 100);

/* Splits a total into advance and balance (both in rupees, exact). */
function splitAdvance(total, pct = percent()) {
  const totalPaise = paise(total);
  let advance = Math.round((totalPaise * pct) / 100);

  // Cashfree needs at least one rupee, and the balance must stay > 0.
  advance = Math.max(100, Math.min(advance, totalPaise - 100));

  if (totalPaise < 200) {
    return null;
  }

  return {
    percent: pct,
    advanceAmount: advance / 100,
    balanceAmount: (totalPaise - advance) / 100
  };
}

function hasAdvance(order) {
  return Boolean(order && order.codAdvance && order.codAdvance.enabled === true);
}

/* What the payment gateway is asked to collect for this order. */
function onlineAmount(order) {
  return hasAdvance(order)
    ? Number(order.codAdvance.advanceAmount)
    : Number(order.grandTotal);
}

/* What the courier must collect in cash on delivery (0 if nothing). */
function cashOnDelivery(order) {
  if (hasAdvance(order)) return Number(order.codAdvance.balanceAmount || 0);

  return order && order.paymentMethod === 'COD' ? Number(order.grandTotal || 0) : 0;
}

module.exports = {
  isEnabled,
  percent,
  splitAdvance,
  hasAdvance,
  onlineAmount,
  cashOnDelivery
};
