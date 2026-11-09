'use strict';

/*
  Keeps the shop in step with Cashfree refunds.

  If you refund a payment in the Cashfree dashboard (or a refund started
  by this website finishes), this reads it back every 15 minutes:

    - the order shows "Refund processing" / "Refunded" for you and the customer
    - if the whole payment was refunded and the order was not shipped,
      the order is cancelled, stock and coupon return, and a booked
      Shiprocket order is cancelled too

  Switch off with REFUND_SYNC=false in Render.
*/

const CHECK_BATCH = 20;
const LOOKBACK_DAYS = 60;

function defaultDeps() {
  const { Order } = require('../models');

  return {
    Order,
    getRefunds: require('./cashfreeRefundService').getCashfreeRefunds,
    onlineAmount: require('../utils/codAdvance').onlineAmount,
    cancellation: require('./orderCancellation')
  };
}

// Adds up the refunds that are not failed/cancelled.
function summarizeRefunds(refunds) {
  let total = 0;
  let done = 0;

  for (const r of Array.isArray(refunds) ? refunds : []) {
    const status = String(r.refund_status || '').toUpperCase();
    const amount = Number(r.refund_amount) || 0;

    if (['SUCCESS', 'PENDING', 'ONHOLD'].includes(status)) {
      total += amount;
      if (status === 'SUCCESS') done += amount;
    }
  }

  return {
    total,
    done,
    status: total > 0 ? (done >= total ? 'REFUNDED' : 'PROCESSING') : null
  };
}

async function sweepRefunds(deps = defaultDeps(), now = new Date()) {
  const { Order, getRefunds, onlineAmount, cancellation } = deps;

  const orders = await Order.find({
    paymentMethod: 'CASHFREE',
    paymentStatus: 'SUCCESS',
    cashfreeOrderId: { $exists: true, $ne: '' },
    'refund.status': { $ne: 'REFUNDED' },
    createdAt: { $gt: new Date(now.getTime() - LOOKBACK_DAYS * 86400000) }
  })
    .sort({ refundCheckedAt: 1 })
    .limit(CHECK_BATCH);

  const result = { checked: 0, updated: 0, cancelled: 0 };

  for (const order of orders) {
    try {
      result.checked += 1;

      const info = summarizeRefunds(await getRefunds(order.cashfreeOrderId));

      if (!info.status) {
        await Order.updateOne({ _id: order._id }, { $set: { refundCheckedAt: now } });
        continue;
      }

      const online = Number(onlineAmount(order)) || 0;
      const full = info.total >= online - 0.01;
      let target = order;
      const notes = [];

      if (full && ['Order Placed', 'Confirmed'].includes(order.orderStatus)) {
        target = await cancellation.cancelInDatabase(order, {
          reason: 'Refund done in Cashfree - order cancelled automatically.',
          keepPaymentSuccess: true
        });

        const sr = await cancellation.cancelShiprocketIfBooked(target);

        if (sr) notes.push(sr);

        result.cancelled += 1;
      }

      const changed = !order.refund || order.refund.status !== info.status;

      if (changed) {
        notes.push(
          info.status === 'REFUNDED'
            ? `Refund of Rs ${info.done} completed (seen in Cashfree).`
            : `Refund of Rs ${info.total} is processing (seen in Cashfree).`
        );
      }

      if (notes.length) {
        target.statusHistory.push({
          status: target.orderStatus,
          note: notes.join(' ').slice(0, 300),
          changedAt: now
        });
      }

      target.refund = { status: info.status, amount: info.total, updatedAt: now };
      target.refundCheckedAt = now;

      if (target.autoCancel) target.markModified('autoCancel');

      await target.save();

      if (changed) result.updated += 1;

    } catch (err) {
      console.warn('[Refund sync]', order.orderId, err.message);
    }
  }

  return result;
}

let timer = null;

function startRefundSync() {
  if (timer || process.env.REFUND_SYNC === 'false') return;

  const run = async () => {
    try {
      const r = await sweepRefunds();

      if (r.updated || r.cancelled) console.log('[Refund sync]', r);
    } catch (err) {
      console.warn('[Refund sync] failed:', err.message);
    }
  };

  setTimeout(run, 90 * 1000).unref();
  timer = setInterval(run, 15 * 60 * 1000);
  timer.unref();
}

module.exports = { sweepRefunds, summarizeRefunds, startRefundSync };
