
/*
=========================================
 MEMORA CREATIONS
 CASHFREE CANCELLATION APPROVAL

 ADMIN ONLY

 Security:
 - Verify Cashfree again
 - Require terminal gateway order
 - Block successful payments
 - Block pending payment attempts
 - Check cancellation request
 - Use MongoDB transaction
 - Release stock only once
 - No automatic refunds
=========================================
*/

const mongoose = require('mongoose');

const {
  Order
} = require('../models');

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


/* =====================================
   CHECK CUSTOMER REQUEST
===================================== */

function hasCancellationRequest(order) {

  const history = Array.isArray(
    order.statusHistory
  )
    ? order.statusHistory
    : [];

  return history.some(item =>

    String(
      item.note || ''
    ).startsWith(REQUEST_MARKER)

  );
}


/* =====================================
   CHECK LOCAL ORDER SAFETY
===================================== */

function validateLocalOrder(order) {

  if (!order) {
    throw error(
      404,
      'Order not found.'
    );
  }

  if (order.paymentMethod !== 'CASHFREE') {
    throw error(
      400,
      'Only Cashfree orders are supported.'
    );
  }

  if (
    !hasCancellationRequest(order)
  ) {
    throw error(
      409,
      'Customer cancellation request not found.'
    );
  }

  if (
    order.orderStatus === 'Cancelled'
  ) {
    throw error(
      409,
      'Order is already cancelled.'
    );
  }

  if (
    ![
      'Order Placed',
      'Confirmed'
    ].includes(order.orderStatus)
  ) {
    throw error(
      409,
      'This order is already being processed.'
    );
  }

  if (
    order.paymentStatus !== 'PENDING'
  ) {
    throw error(
      409,
      'Payment status changed. Manual review required.'
    );
  }

  if (
    order.stockReserved !== true
  ) {
    throw error(
      409,
      'Stock reservation must be reviewed.'
    );
  }

  if (
    !order.cashfreeOrderId
  ) {
    throw error(
      409,
      'Cashfree order reference missing.'
    );
  }

}


/* =====================================
   VERIFY CASHFREE PAYMENT

   Must be called before approval.
===================================== */

async function verifyGatewaySafety(order) {

  const gatewayId =
    String(
      order.cashfreeOrderId
    ).trim();

  const inspection =
    await inspectCashfreeOrder(
      gatewayId
    );

  const gatewayOrder =
    inspection.gatewayOrder;

  /*
    Ensure gateway identity matches.
  */

  if (
    String(
      gatewayOrder?.order_id || ''
    ) !== gatewayId
  ) {
    throw error(
      409,
      'Cashfree order identity mismatch.'
    );
  }

  /*
    An order can be cancelled only
    after Cashfree has reached a
    terminal, non-paid state.
  */

  const status =
    String(
      inspection.orderStatus || ''
    ).toUpperCase();

  if (
    ![
      'EXPIRED',
      'TERMINATED'
    ].includes(status)
  ) {
    throw error(
      409,
      'Cashfree order is not terminal. Cancellation blocked.'
    );
  }

  /*
    Check payment order, amount,
    currency and all payment attempts.

    Never interpret only one FAILED
    payment attempt as proof that
    the entire order was unpaid.
  */

  const confirmedPaid =
    isCashfreePaymentSuccessful(
      gatewayOrder,
      order.grandTotal
    );

  const summary =
    inspection.summary;

  if (
    confirmedPaid ||
    summary.hasSuccessfulPayment ||
    summary.hasPendingPayment
  ) {
    throw error(
      409,
      'Cashfree payment requires manual review. Cancellation blocked.'
    );
  }

  /*
    Check gateway amount/currency,
    even for expired orders.
  */

  const expectedAmount =
    Number(order.grandTotal);

  const gatewayAmount =
    Number(
      gatewayOrder?.order_amount
    );

  if (
    gatewayOrder?.order_currency !== 'INR' ||
    !Number.isFinite(expectedAmount) ||
    !Number.isFinite(gatewayAmount) ||
    Math.round(expectedAmount * 100) !==
      Math.round(gatewayAmount * 100)
  ) {
    throw error(
      409,
      'Cashfree amount or currency mismatch.'
    );
  }

  /*
    Fail closed if Cashfree reports
    an unexpected order/payment
    state or missing attempt data.
  */

  if (
    !Array.isArray(
      inspection.payments
    ) ||
    !summary ||
    summary.other > 0
  ) {
    throw error(
      409,
      'Unknown Cashfree payment state. Manual review required.'
    );
  }

  return {
    status,
    summary
  };

}


/* =====================================
   APPROVE CASHFREE CANCELLATION

   POST:
   /api/admin/orders/:id/cashfree/approve

   Body:
   {
     "confirmed": true
   }
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

    /*
      Require deliberate approval.
    */

    if (
      req.body?.confirmed !== true
    ) {
      throw error(
        400,
        'Admin confirmation required.'
      );
    }

    /*
      Read order before gateway
      verification.
    */

    const original =
      await Order.findById(orderId);

    validateLocalOrder(original);

    /*
      Recheck Cashfree immediately
      before the database transaction.

      Gateway request errors block
      cancellation automatically.
    */

    const verified =
      await verifyGatewaySafety(
        original
      );

    /*
      Protect against concurrent
      local payment/order changes
      using a database transaction.
    */

    const session =
      await mongoose.startSession();

    let cancelledOrder;

    try {

      await session.withTransaction(
        async () => {

          const freshOrder =
            await Order.findById(
              orderId
            ).session(session);

          /*
            Recheck all local conditions
            inside the transaction.
          */

          validateLocalOrder(
            freshOrder
          );

          if (
            String(freshOrder.cashfreeOrderId) !==
            String(original.cashfreeOrderId)
          ) {
            throw error(
              409,
              'Payment reference changed.'
            );
          }

          /*
            Restore stock through
            the existing order service.

            This function uses the
            same MongoDB transaction.
          */

          await releaseStock(
            freshOrder,
            session
          );

          /*
            Update payment and
            order status together.
          */

          freshOrder.orderStatus =
            'Cancelled';

          freshOrder.paymentStatus =
            'CANCELLED';

          freshOrder.statusHistory.push({
            status: 'Cancelled',

            note:
              'Cashfree cancellation approved ' +
              'by admin after verifying terminal ' +
              'gateway status: ' +
              verified.status,

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
        'Cashfree cancellation approved successfully.',

      cashfreeStatus:
        verified.status,

      refundInitiated: false,

      order: cancelledOrder

    });

  });


/* =====================================
   EXPORT
===================================== */

module.exports = {
  approveCancellation
};
