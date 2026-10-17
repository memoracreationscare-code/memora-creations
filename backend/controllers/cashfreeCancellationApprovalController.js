
/*
=========================================
 MEMORA CREATIONS

 CASHFREE CANCELLATION APPROVAL

 ADMIN ONLY — SAFETY CHECKS

 - Customer request required
 - Cashfree order must be terminal
 - Every payment attempt checked
 - Successful payment blocked
 - Pending payment blocked
 - Unknown payment state blocked
 - Amount and currency verified
 - Stock released in transaction
 - Concurrent local updates checked
 - No automatic refund
=========================================
*/

const mongoose = require('mongoose');

const { Order } = require('../models');

const {
  asyncHandler,
  error,
  ok
} = require('../utils/http');

const {
  inspectCashfreeOrder,
  isCashfreePaymentSuccessful
} = require('../services/cashfreeService');

const {
  releaseStock
} = require('../services/orderService');


const REQUEST_MARKER =
  'CUSTOMER_CASHFREE_CANCEL_REQUEST';

const ELIGIBLE_ORDER_STATUSES = [
  'Order Placed',
  'Confirmed'
];

const TERMINAL_CASHFREE_STATUSES = [
  'EXPIRED',
  'TERMINATED'
];

const SAFE_FAILED_ATTEMPTS = [
  'FAILED',
  'USER_DROPPED'
];


/* =====================================
   CUSTOMER REQUEST CHECK
===================================== */

function hasCancellationRequest(order) {

  const history =
    Array.isArray(order?.statusHistory)
      ? order.statusHistory
      : [];

  return history.some(item => {

    return String(
      item.note || ''
    ).startsWith(REQUEST_MARKER);

  });

}


/* =====================================
   CHECK DATABASE ORDER
===================================== */

function validateLocalOrder(order) {

  if (!order) {
    throw error(
      404,
      'Order not found.'
    );
  }

  if (
    order.paymentMethod !== 'CASHFREE'
  ) {
    throw error(
      400,
      'Only Cashfree orders are supported.'
    );
  }

  if (!hasCancellationRequest(order)) {
    throw error(
      409,
      'Customer cancellation request is missing.'
    );
  }

  if (
    !ELIGIBLE_ORDER_STATUSES.includes(
      order.orderStatus
    )
  ) {
    throw error(
      409,
      'Order status does not allow cancellation.'
    );
  }

  if (
    order.paymentStatus !== 'PENDING'
  ) {
    throw error(
      409,
      'Payment is not pending. Manual review required.'
    );
  }

  if (
    order.stockReserved !== true
  ) {
    throw error(
      409,
      'Stock reservation requires manual review.'
    );
  }

  if (
    !String(
      order.cashfreeOrderId || ''
    ).trim()
  ) {
    throw error(
      409,
      'Cashfree order ID is missing.'
    );
  }

}


/* =====================================
   VALIDATE GATEWAY AMOUNT
===================================== */

function validateGatewayIdentity(
  order,
  gatewayOrder
) {

  const localId =
    String(order.cashfreeOrderId);

  const gatewayId =
    String(
      gatewayOrder?.order_id || ''
    );

  if (localId !== gatewayId) {
    throw error(
      409,
      'Cashfree order ID mismatch.'
    );
  }

  const localAmount =
    Number(order.grandTotal);

  const gatewayAmount =
    Number(
      gatewayOrder?.order_amount
    );

  if (
    gatewayOrder?.order_currency !== 'INR' ||
    !Number.isFinite(localAmount) ||
    !Number.isFinite(gatewayAmount) ||
    localAmount <= 0 ||
    gatewayAmount <= 0 ||
    Math.round(localAmount * 100) !==
      Math.round(gatewayAmount * 100)
  ) {
    throw error(
      409,
      'Cashfree amount or currency mismatch.'
    );
  }

}


/* =====================================
   VERIFY CASHFREE LIVE STATUS
===================================== */

async function verifyCashfreeSafety(order) {

  const inspection =
    await inspectCashfreeOrder(
      String(order.cashfreeOrderId)
    );

  const gatewayOrder =
    inspection.gatewayOrder;

  validateGatewayIdentity(
    order,
    gatewayOrder
  );

  const status =
    String(
      inspection.orderStatus || ''
    ).toUpperCase();

  /*
    Only confirmed terminal
    non-paid gateway orders.
  */

  if (
    !TERMINAL_CASHFREE_STATUSES.includes(
      status
    )
  ) {
    throw error(
      409,
      'Cashfree order is not terminal. Cancellation blocked.'
    );
  }

  if (
    !Array.isArray(
      inspection.payments
    )
  ) {
    throw error(
      409,
      'Payment attempts could not be verified.'
    );
  }

  if (
    isCashfreePaymentSuccessful(
      gatewayOrder,
      order.grandTotal
    )
  ) {
    throw error(
      409,
      'Payment successful. Refund review required.'
    );
  }

  /*
    Check every attempt.

    No unknown, pending or
    successful attempt may pass.

    Only known unsuccessful
    statuses are allowed.
  */

  for (
    const payment of inspection.payments
  ) {

    const paymentStatus =
      String(
        payment?.payment_status || ''
      ).toUpperCase();

    if (
      !SAFE_FAILED_ATTEMPTS.includes(
        paymentStatus
      )
    ) {
      throw error(
        409,
        'Cashfree payment attempt needs manual review. Cancellation blocked.'
      );
    }

  }

  const summary =
    inspection.summary;

  if (
    !summary ||
    summary.hasSuccessfulPayment ||
    summary.hasPendingPayment ||
    summary.other !== 0 ||
    summary.successful !== 0 ||
    summary.pending !== 0
  ) {
    throw error(
      409,
      'Cashfree payment verification was not conclusive.'
    );
  }

  return {
    gatewayStatus: status,
    checkedAt: new Date()
  };

}


/* =====================================
   APPROVE CANCELLATION

   POST
   /api/admin/orders/:id/cashfree/approve

   BODY:
   {
     "confirmed": true
   }

   Route must use requireAdmin.
===================================== */

const approveCancellation =
  asyncHandler(async (req, res) => {

    const orderId =
      req.params.id;

    if (
      !mongoose.isValidObjectId(orderId)
    ) {
      throw error(
        400,
        'Invalid order ID.'
      );
    }

    if (
      req.body?.confirmed !== true
    ) {
      throw error(
        400,
        'Explicit admin confirmation required.'
      );
    }

    /*
      Read current database state.
    */

    const original =
      await Order.findById(orderId);

    validateLocalOrder(original);

    /*
      Check live gateway state.

      Network failure, unexpected
      status or payment conflict
      will block approval.
    */

    const verified =
      await verifyCashfreeSafety(
        original
      );

    /*
      DB transaction keeps stock
      and order status together.
    */

    const session =
      await mongoose.startSession();

    let cancelledOrder = null;

    try {

      await session.withTransaction(
        async () => {

          /*
            Read the latest local
            order inside transaction.
          */

          const freshOrder =
            await Order.findById(
              orderId
            ).session(session);

          validateLocalOrder(
            freshOrder
          );

          /*
            Prevent approving if
            order data changed while
            payment was verified.
          */

          if (
            String(
              freshOrder.cashfreeOrderId
            ) !== String(
              original.cashfreeOrderId
            ) ||
            Number(
              freshOrder.grandTotal
            ) !== Number(
              original.grandTotal
            )
          ) {
            throw error(
              409,
              'Order payment details changed. Approval blocked.'
            );
          }

          /*
            Release stock exactly
            within this transaction.
          */

          await releaseStock(
            freshOrder,
            session
          );

          /*
            Only after stock operation
            succeeds, update order.
          */

          freshOrder.orderStatus =
            'Cancelled';

          freshOrder.paymentStatus =
            'CANCELLED';

          freshOrder.statusHistory.push({
            status: 'Cancelled',

            note:
              'Cashfree cancellation approved ' +
              'by admin after terminal gateway ' +
              'verification: ' +
              verified.gatewayStatus,

            changedAt: new Date()
          });

          await freshOrder.save({
            session
          });

          cancelledOrder =
            freshOrder;

        }
      );

    } finally {

      await session.endSession();

    }

    return ok(res, {

      message:
        'Cashfree order cancellation completed.',

      gatewayStatus:
        verified.gatewayStatus,

      paymentStatus:
        cancelledOrder.paymentStatus,

      orderStatus:
        cancelledOrder.orderStatus,

      stockReserved:
        cancelledOrder.stockReserved,

      refundInitiated: false,

      orderId:
        cancelledOrder.orderId

    });

  });


/* =====================================
   EXPORT
===================================== */

module.exports = {
  approveCancellation
};
