'use strict';

/*
  Online orders whose payment was never completed used to stay in the
  admin panel as "Pending" and keep their stock reserved for ever.

  Every 15 minutes this looks at Cashfree orders that are still unpaid
  40 minutes after they were placed (the payment link lasts 30 minutes):

    - Cashfree says PAID   -> the webhook was missed: mark it paid now
    - anything else        -> cancel the order, give the stock back

  Switch off with PENDING_PAYMENT_AUTO_CANCEL=false in Render.
*/

const STALE_MINUTES = 40;
const BATCH = 25;

function defaultDeps() {
  const { Order } = require('../models');
  const cashfree = require('./cashfreeService');
  const details = require('../utils/paymentDetails');
  const codAdvanceRules = require('../utils/codAdvance');

  return {
    Order,
    fetchOrder: cashfree.fetchCashfreeOrder,
    isPaid: cashfree.isCashfreePaymentSuccessful,
    fetchPayments: cashfree.fetchCashfreePayments,
    details,
    onlineAmount: codAdvanceRules.onlineAmount,
    cancel: (order, opts) => require('./orderCancellation').autoCancelOrder(order, opts)
  };
}

async function sweepPendingPayments(deps = defaultDeps(), now = new Date()) {
  const {
    Order, fetchOrder, isPaid, fetchPayments, details, onlineAmount, cancel
  } = deps;

  const orders = await Order.find({
    paymentMethod: 'CASHFREE',
    paymentStatus: 'PENDING',
    orderStatus: 'Order Placed',
    cashfreeOrderId: { $exists: true, $ne: '' },
    createdAt: { $lt: new Date(now.getTime() - STALE_MINUTES * 60 * 1000) }
  })
    .sort({ createdAt: 1 })
    .limit(BATCH);

  const result = { cancelled: 0, markedPaid: 0, skipped: 0 };

  for (const order of orders) {
    try {
      const gateway = await fetchOrder(order.cashfreeOrderId);

      if (gateway.order_status === 'PAID') {
        if (!isPaid(gateway, onlineAmount(order))) {
          result.skipped += 1;
          continue;
        }

        let paymentDetails = null;

        try {
          paymentDetails = details.extractPaymentDetails(
            details.pickSuccessfulPayment(await fetchPayments(order.cashfreeOrderId))
          );
        } catch { /* details are optional */ }

        const updated = await Order.findOneAndUpdate(
          { _id: order._id, paymentStatus: 'PENDING', orderStatus: { $ne: 'Cancelled' } },
          {
            $set: {
              paymentStatus: 'SUCCESS',
              ...(paymentDetails ? { paymentDetails } : {})
            },
            $push: {
              statusHistory: {
                status: order.orderStatus,
                note: 'Cashfree payment confirmed by automatic check.',
                changedAt: new Date()
              }
            }
          },
          { new: true }
        );

        if (updated) result.markedPaid += 1;
        continue;
      }

      await cancel(order, {
        reason: 'Payment not completed in time - order cancelled automatically.'
      });

      result.cancelled += 1;

    } catch (err) {
      result.skipped += 1;
      console.warn('[Pending payments]', order.orderId, err.message);
    }
  }

  return result;
}

let timer = null;

function startPendingPaymentSweeper() {
  if (timer || process.env.PENDING_PAYMENT_AUTO_CANCEL === 'false') return;

  const run = async () => {
    try {
      const r = await sweepPendingPayments();

      if (r.cancelled || r.markedPaid) {
        console.log('[Pending payments]', r);
      }
    } catch (err) {
      console.warn('[Pending payments] failed:', err.message);
    }
  };

  setTimeout(run, 2 * 60 * 1000).unref();
  timer = setInterval(run, 15 * 60 * 1000);
  timer.unref();
}

module.exports = { sweepPendingPayments, startPendingPaymentSweeper, STALE_MINUTES };
