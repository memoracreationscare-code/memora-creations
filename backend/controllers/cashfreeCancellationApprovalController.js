
/*
=========================================
 MEMORA CREATIONS
 CASHFREE CANCELLATION APPROVAL

 SANDBOX ONLY

 - Admin confirmation required
 - Customer cancellation request required
 - Payment must be PENDING locally
 - Cashfree must be EXPIRED or TERMINATED
 - All payment attempts checked
 - Gateway verified again before stock change
 - Database transaction
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
  getCashfreeConfig,
  inspectCashfreeOrder,
  isCashfreePaymentSuccessful
} = require('../services/cashfreeService');

const {
  releaseStock
} = require('../services/orderService');

const REQUEST_MARKER =
  'CUSTOMER_CASHFREE_CANCEL_REQUEST';

const ALLOWED_ORDER_STATUSES = [
  'Order Placed',
  'Confirmed'
];

const TERMINAL_GATEWAY_STATUSES = [
  'EXPIRED',
  'TERMINATED'
];

const UNSUCCESSFUL_ATTEMPTS = [
  'FAILED',
  'USER_DROPPED'
];


/* =====================================
   CHECK SANDBOX MODE
===================================== */

function requireSandbox() {

  const config = getCashfreeConfig();

  if (
    config.env !== 'sandbox' ||
    process.env
      .CASHFREE_CANCELLATION_APPROVAL_ENABLED
      !== 'true'
  ) {
    throw error(
      403,
      'Cashfree cancellation approval is disabled.'
    );
  }

}


/* =====================================
   CHECK CUSTOMER REQUEST
===================================== */

function hasCancellationRequest(order) {

  const history = Array.isArray(
    order?.statusHistory
  ) ? order.statusHistory : [];

  return history.some(item =>
    String(item.note || '')
      .startsWith(REQUEST_MARKER)
  );

}


/* =====================================
   VALIDATE LOCAL ORDER
===================================== */

function validateOrder(order) {

  if (!order) {
    throw error(
      404,
      'Order not found.'
    );
  }

  if (order.paymentMethod !== 'CASHFREE') {
    throw error(
      409,
      'Not a Cashfree order.'
    );
  }

  if (!hasCancellationRequest(order)) {
    throw error(
      409,
      'Customer cancellation request not found.'
    );
  }

  if (
    !ALLOWED_ORDER_STATUSES.includes(
      order.orderStatus
    )
  ) {
    throw error(
      409,
      'Order is not eligible for cancellation.'
    );
  }

  if (order.paymentStatus !== 'PENDING') {
    throw error(
      409,
      'Payment is not pending.'
    );
  }

  if (order.stockReserved !== true) {
    throw error(
      409,
      'Stock is not reserved.'
    );
  }

  if (!String(order.cashfreeOrderId || '').trim()) {
    throw error(
      409,
      'Cashfree order ID missing.'
    );
  }

  if (
    !Number.isFinite(Number(order.grandTotal)) ||
    Number(order.grandTotal) <= 0
  ) {
    throw error(
      409,
      'Invalid order amount.'
    );
  }

}


/* =====================================
   VERIFY CASHFREE PAYMENT

   FAIL CLOSED:
   If any gateway data is missing,
   unknown or contradictory,
   cancellation is blocked.
===================================== */

async function verifyGateway(order) {

  const inspection =
    await inspectCashfreeOrder(
      String(order.cashfreeOrderId)
    );

  const gatewayOrder =
    inspection?.gatewayOrder;

  if (
    String(gatewayOrder?.order_id || '') !==
    String(order.cashfreeOrderId)
  ) {
    throw error(
      409,
      'Cashfree order ID mismatch.'
    );
  }

  const localAmount =
    Number(order.grandTotal);

  const gatewayAmount =
    Number(gatewayOrder?.order_amount);

  if (
    gatewayOrder?.order_currency !== 'INR' ||
    !Number.isFinite(gatewayAmount) ||
    Math.round(localAmount * 100) !==
      Math.round(gatewayAmount * 100)
  ) {
    throw error(
      409,
      'Cashfree amount or currency mismatch.'
    );
  }

  const status = String(
    inspection.orderStatus || ''
  ).toUpperCase();

  if (
    !TERMINAL_GATEWAY_STATUSES.includes(status)
  ) {
    throw error(
      409,
      'Cashfree order is not terminal.'
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
      'Successful payment detected.'
    );
  }

  if (!Array.isArray(inspection.payments)) {
    throw error(
      409,
      'Cashfree payment attempts unavailable.'
    );
  }

  for (const payment of inspection.payments) {

    const paymentStatus = String(
      payment?.payment_status || ''
    ).toUpperCase();

    if (
      !UNSUCCESSFUL_ATTEMPTS.includes(
        paymentStatus
      )
    ) {
      throw error(
        409,
        'Payment attempt requires manual review.'
      );
    }

  }

  const summary = inspection.summary;

  if (
    !summary ||
    summary.hasSuccessfulPayment ||
    summary.hasPendingPayment ||
    summary.successful !== 0 ||
    summary.pending !== 0 ||
    summary.other !== 0 ||
    summary.totalAttempts !==
      inspection.payments.length
  ) {
    throw error(
      409,
      'Cashfree payment state is inconclusive.'
    );
  }

  return {
    status,
    checkedAt: new Date()
  };

}


/* =====================================
   APPROVE CANCELLATION

   POST:
   /api/admin/orders/:id/cashfree/approve

   JSON:
   {
     "confirmed": true
   }
===================================== */

const approveCancellation =
  asyncHandler(async (req, res) => {

    requireSandbox();

    const orderId = req.params.id;

    if (!mongoose.isValidObjectId(orderId)) {
      throw error(
        400,
        'Invalid order ID.'
      );
    }

    if (req.body?.confirmed !== true) {
      throw error(
        400,
        'Explicit admin confirmation required.'
      );
    }

    const original =
      await Order.findById(orderId);

    validateOrder(original);

    /*
      First gateway check before
      starting the transaction.
    */

    await verifyGateway(original);

    const session =
      await mongoose.startSession();

    let cancelledOrder = null;
    let lastVerification = null;

    try {

      await session.withTransaction(
        async () => {

          const freshOrder =
            await Order.findById(
              orderId
            ).session(session);

          validateOrder(freshOrder);

          /*
            Block payment reference or
            amount changes.
          */

          if (
            String(freshOrder.cashfreeOrderId) !==
              String(original.cashfreeOrderId) ||
            Math.round(
              Number(freshOrder.grandTotal) * 100
            ) !== Math.round(
              Number(original.grandTotal) * 100
            )
          ) {
            throw error(
              409,
              'Order payment details changed.'
            );
          }

          /*
            SECOND GATEWAY CHECK.

            Recheck Cashfree as close
            as possible to cancellation.

            If this request fails,
            the transaction aborts.
          */

          lastVerification =
            await verifyGateway(freshOrder);

          /*
            Release stock in the
            same MongoDB transaction.
          */

          await releaseStock(
            freshOrder,
            session
          );

          freshOrder.orderStatus =
            'Cancelled';

          freshOrder.paymentStatus =
            'CANCELLED';

          freshOrder.statusHistory.push({

            status: 'Cancelled',

            note:
              'Sandbox Cashfree cancellation approved ' +
              'after terminal gateway verification: ' +
              lastVerification.status,

            changedAt: new Date()

          });

          await freshOrder.save({
            session
          });

          cancelledOrder = freshOrder;

        }
      );

    } finally {

      await session.endSession();

    }

    return ok(res, {

      message:
        'Sandbox Cashfree cancellation approved.',

      orderId:
        cancelledOrder.orderId,

      orderStatus:
        cancelledOrder.orderStatus,

      paymentStatus:
        cancelledOrder.paymentStatus,

      stockReserved:
        cancelledOrder.stockReserved,

      cashfreeStatus:
        lastVerification.status,

      refundInitiated: false

    });

  });


/* =====================================
   EXPORT
===================================== */

module.exports = {
  approveCancellation
};
