'use strict';

/*
  "Did a customer pay and we lost track of it?"

  Read-only. Looks for the four ways an online payment can go wrong
  and tells the owner which order to look at:

    1. PAID_CANCELLED   money taken, order cancelled, no refund recorded yet
    2. PAID_NO_STOCK    money taken, but the order has no stock reserved
    3. STUCK_PENDING    unpaid order that the 15-minute clean-up did not settle
    4. CANCELLED_BUT_PAID_AT_GATEWAY
                        we cancelled / failed it, yet Cashfree says PAID
                        (a late payment that the webhook could not use)

  It changes nothing and sends nothing; the dashboard shows the result.
*/

const STUCK_MINUTES = 60;
const LIMIT = 20;
const GATEWAY_LOOKBACK_DAYS = 3;
const GATEWAY_BATCH = 15;

function defaultDeps() {
  const { Order } = require('../models');
  const cashfree = require('./cashfreeService');

  return {
    Order,
    fetchOrder: cashfree.fetchCashfreeOrder,
    isPaid: cashfree.isCashfreePaymentSuccessful,
    onlineAmount: require('../utils/codAdvance').onlineAmount
  };
}

const FIELDS = 'orderId grandTotal paymentStatus orderStatus stockReserved cashfreeOrderId createdAt updatedAt paymentMethod codAdvance refund autoCancel';

const find = (Order, query, sort = { createdAt: -1 }, limit = LIMIT) =>
  Order.find(query).select(FIELDS).sort(sort).limit(limit).lean();

const label = o => `#${o.orderId || o._id}`;

async function scan(deps = defaultDeps(), now = new Date()) {
  const { Order, fetchOrder, isPaid, onlineAmount } = deps;
  const alerts = [];

  const paidCancelled = await find(Order, {
    paymentMethod: 'CASHFREE',
    paymentStatus: 'SUCCESS',
    orderStatus: 'Cancelled'
  });

  for (const o of paidCancelled) {
    const refunded = o.refund && o.refund.status;
    const submitted = o.autoCancel && o.autoCancel.refundStatus === 'SUBMITTED';

    if (refunded || submitted) continue;

    alerts.push({
      code: 'PAID_CANCELLED', orderId: o.orderId,
      text: `${label(o)}: customer ka paisa kata hai par order cancel hai aur refund nahi hua. Refund karein.`
    });
  }

  const noStock = await find(Order, {
    paymentMethod: 'CASHFREE',
    paymentStatus: 'SUCCESS',
    orderStatus: { $ne: 'Cancelled' },
    stockReserved: { $ne: true }
  });

  for (const o of noStock) {
    alerts.push({
      code: 'PAID_NO_STOCK', orderId: o.orderId,
      text: `${label(o)}: paisa mil gaya par is order ka stock reserve nahi hua. Order ko haath se dekhein.`
    });
  }

  const stuck = await find(Order, {
    paymentMethod: 'CASHFREE',
    paymentStatus: 'PENDING',
    orderStatus: 'Order Placed',
    createdAt: { $lt: new Date(now.getTime() - STUCK_MINUTES * 60 * 1000) }
  }, { createdAt: 1 });

  for (const o of stuck) {
    alerts.push({
      code: 'STUCK_PENDING', orderId: o.orderId,
      text: `${label(o)}: payment ${STUCK_MINUTES} minute se zyada se pending hai aur apne aap settle nahi hua. Cashfree me dekhein.`
    });
  }

  const recent = await find(Order, {
    paymentMethod: 'CASHFREE',
    paymentStatus: { $in: ['CANCELLED', 'FAILED'] },
    cashfreeOrderId: { $exists: true, $ne: '' },
    updatedAt: { $gte: new Date(now.getTime() - GATEWAY_LOOKBACK_DAYS * 86400000) }
  }, { updatedAt: -1 }, GATEWAY_BATCH);

  let checked = 0;

  for (const o of recent) {
    try {
      const gateway = await fetchOrder(o.cashfreeOrderId);

      checked += 1;

      if (gateway && gateway.order_status === 'PAID' && isPaid(gateway, onlineAmount(o))) {
        alerts.push({
          code: 'CANCELLED_BUT_PAID_AT_GATEWAY', orderId: o.orderId,
          text: `${label(o)}: order cancel/fail hai par Cashfree par payment PAID hai. Customer ko refund dein ya order dobara chalayein.`
        });
      }
    } catch (_) { /* one failed lookup must not hide the others */ }
  }

  return { alerts, checkedGateway: checked };
}

module.exports = { scan, STUCK_MINUTES };
