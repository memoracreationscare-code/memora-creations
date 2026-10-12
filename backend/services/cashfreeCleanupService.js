
/*
=========================================
 MEMORA CREATIONS
 CASHFREE CLEANUP SERVICE

 PAYMENT RECONCILIATION
 PENDING ORDER INSPECTION
 SAFE STOCK PROTECTION

 INSPECTION MODE ONLY

 This service does not change orders
 or release stock automatically.
=========================================
*/

const {
  Order
} = require('../models');

const {
  inspectCashfreeOrder,
  isCashfreePaymentSuccessful
} = require('./cashfreeService');


/* =====================================
   INSPECT ONE CASHFREE ORDER
===================================== */

async function inspectPendingCashfreeOrder(orderId) {

  const order = await Order.findById(
    orderId
  );

  if (!order) {
    throw new Error(
      'Order not found.'
    );
  }

  if (order.paymentMethod !== 'CASHFREE') {
    return {
      orderId: order.orderId,
      action: 'SKIP',
      reason: 'Not a Cashfree order.'
    };
  }

  if (order.paymentStatus === 'SUCCESS') {
    return {
      orderId: order.orderId,
      action: 'KEEP',
      reason: 'Payment already successful.'
    };
  }

  if (order.orderStatus === 'Cancelled') {
    return {
      orderId: order.orderId,
      action: 'REVIEW',
      reason: 'Order already cancelled.'
    };
  }

  if (!order.stockReserved) {
    return {
      orderId: order.orderId,
      action: 'REVIEW',
      reason: 'Stock is not reserved.'
    };
  }

  if (!order.cashfreeOrderId) {
    return {
      orderId: order.orderId,
      action: 'REVIEW',
      reason: 'Cashfree reference missing.'
    };
  }

  /*
    Verify directly with Cashfree.

    Any API error must stop inspection.
    Never assume a failed API request
    means the customer did not pay.
  */

  const inspection = await inspectCashfreeOrder(
    order.cashfreeOrderId
  );

  const gatewayOrder =
    inspection.gatewayOrder;

  if (
    String(gatewayOrder.order_id) !==
    String(order.cashfreeOrderId)
  ) {
    return {
      orderId: order.orderId,
      action: 'REVIEW',
      reason: 'Cashfree order ID mismatch.'
    };
  }

  const actualAmount =
    Number(gatewayOrder.order_amount);

  const expectedAmount =
    Number(order.grandTotal);

  const amountMatches =
    Number.isFinite(actualAmount) &&
    Number.isFinite(expectedAmount) &&
    Math.round(actualAmount * 100) ===
      Math.round(expectedAmount * 100);

  if (
    gatewayOrder.order_currency !== 'INR' ||
    !amountMatches
  ) {
    return {
      orderId: order.orderId,
      action: 'REVIEW',
      reason: 'Amount or currency mismatch.'
    };
  }

  const paid =
    isCashfreePaymentSuccessful(
      gatewayOrder,
      order.grandTotal
    );

  if (
    paid ||
    inspection.orderStatus === 'PAID' ||
    inspection.summary.hasSuccessfulPayment
  ) {
    return {
      orderId: order.orderId,
      action: 'VERIFY_PAYMENT',
      reason: 'Successful payment detected.'
    };
  }

  if (
    inspection.summary.hasPendingPayment
  ) {
    return {
      orderId: order.orderId,
      action: 'WAIT',
      reason: 'Payment attempt is pending.'
    };
  }

  /*
    Even an EXPIRED or TERMINATED
    order may require reconciliation
    of in-flight payment events.

    Do not release stock here.
  */

  if (
    inspection.terminal &&
    !inspection.requiresManualReview
  ) {
    return {
      orderId: order.orderId,
      cashfreeOrderId: order.cashfreeOrderId,
      action: 'REVIEW_FOR_RELEASE',
      reason:
        'Gateway order is terminal with no reported successful or pending payments. Additional reconciliation is required before stock release.'
    };
  }

  return {
    orderId: order.orderId,
    action: 'WAIT',
    reason:
      'Cashfree payment order is not in a verified terminal state.'
  };

}


/* =====================================
   INSPECT OLD PENDING ORDERS

   Returns a report only.
   Does not modify MongoDB.
===================================== */

async function inspectOldCashfreeOrders({
  olderThanMinutes = 60,
  limit = 20
} = {}) {

  const minutes = Number(
    olderThanMinutes
  );

  const safeLimit = Math.min(
    100,
    Math.max(1, Number(limit) || 20)
  );

  if (
    !Number.isFinite(minutes) ||
    minutes < 1
  ) {
    throw new Error(
      'Invalid cleanup age.'
    );
  }

  const cutoff = new Date(
    Date.now() - minutes * 60 * 1000
  );

  const orders = await Order.find({
    paymentMethod: 'CASHFREE',
    paymentStatus: {
      $in: ['PENDING', 'FAILED']
    },
    stockReserved: true,
    orderStatus: {
      $ne: 'Cancelled'
    },
    createdAt: {
      $lte: cutoff
    }
  })
    .sort({
      createdAt: 1
    })
    .limit(safeLimit)
    .select('_id')
    .lean();

  const results = [];

  for (const order of orders) {

    try {

      const result =
        await inspectPendingCashfreeOrder(
          order._id
        );

      results.push(result);

    } catch (err) {

      console.error(
        'Cashfree inspection failed:',
        String(order._id),
        err.message
      );

      results.push({
        orderId: String(order._id),
        action: 'ERROR',
        reason:
          'Gateway inspection failed. No stock changes made.'
      });

    }

  }

  return {
    inspected: results.length,
    stockReleased: 0,
    mode: 'INSPECTION_ONLY',
    results
  };

}


/* =====================================
   EXPORTS
===================================== */

module.exports = {
  inspectPendingCashfreeOrder,
  inspectOldCashfreeOrders
};
