'use strict';

/*
  Return / replacement request rules (pure functions, easy to test).

  A customer can ask for a return or replacement only after the order
  is Delivered, within RETURN_WINDOW_DAYS (default 7) of delivery, and
  only once per order.
*/

const DAY_MS = 24 * 60 * 60 * 1000;

function windowDays() {
  const n = Number(require('../services/settingsService').peek().returnWindowDays);

  return Number.isFinite(n) && n >= 1 && n <= 60 ? Math.floor(n) : 7;
}

function deliveredAt(order) {
  const history = Array.isArray(order?.statusHistory) ? order.statusHistory : [];

  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i]?.status === 'Delivered' && history[i].changedAt) {
      return new Date(history[i].changedAt);
    }
  }

  return order?.updatedAt ? new Date(order.updatedAt) : null;
}

// Returns { ok: true } or { ok: false, message }.
function checkEligibility(order, now = new Date()) {
  if (!require('../services/settingsService').peek().returnsEnabled) {
    return { ok: false, message: 'Returns are not being accepted right now.' };
  }

  if (!order || order.orderStatus !== 'Delivered') {
    return { ok: false, message: 'Return can be requested only after the order is delivered.' };
  }

  if (order.returnRequest?.status) {
    return { ok: false, message: 'A return request already exists for this order.' };
  }

  const delivered = deliveredAt(order);

  if (!delivered || Number.isNaN(delivered.getTime())) {
    return { ok: false, message: 'Delivery date not found for this order.' };
  }

  const days = windowDays();

  if (now.getTime() - delivered.getTime() > days * DAY_MS) {
    return {
      ok: false,
      message: `The ${days}-day return window for this order has ended. Please contact support on WhatsApp.`
    };
  }

  return { ok: true };
}

module.exports = { windowDays, deliveredAt, checkEligibility };
