
/*
=========================================
 MEMORA CREATIONS
 CASHFREE CANCELLATION REVIEW

 ADMIN PAYMENT VERIFICATION

 READ ONLY

 Does NOT:
 - Cancel an order
 - Change payment status
 - Release stock
 - Initiate a refund
 - Approve a cancellation
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


/* =====================================
   REQUEST HISTORY MARKER
===================================== */

const REQUEST_MARKER =
  'CUSTOMER_CASHFREE_CANCEL_REQUEST';


/* =====================================
   VERIFY CASHFREE CANCELLATION REQUEST

   GET
   /api/admin/orders/:id/cashfree/verify

   This controller must be connected
   to a requireAdmin protected route.
===================================== */

const verifyCancellationPayment =
  asyncHandler(async (req, res) => {

    const orderId = req.params.id;

    if (!mongoose.isValidObjectId(orderId)) {

      throw error(
        400,
        'Invalid order ID.'
      );

    }

    /*
      Find order in our database.
      No database updates happen here.
    */

    const order = await Order.findById(
      orderId
    ).lean();

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

    /*
      Verify that the customer
      actually submitted a request.
    */

    const history =
      Array.isArray(order.statusHistory)
        ? order.statusHistory
        : [];

    const cancellationRequest =
      history
        .filter(item => {

          return String(
            item.note || ''
          ).startsWith(REQUEST_MARKER);

        })
        .sort((a, b) => {

          return (
            new Date(b.changedAt || 0) -
            new Date(a.changedAt || 0)
          );

        })[0];

    if (!cancellationRequest) {

      throw error(
        409,
        'No customer cancellation request found.'
      );

    }

    /*
      Cashfree order ID stored
      against this order.
    */

    const cashfreeOrderId =
      String(
        order.cashfreeOrderId || ''
      ).trim();

    if (!cashfreeOrderId) {

      throw error(
        409,
        'Cashfree order ID is missing. Manual review required.'
      );

    }

    /*
      Fetch live order status AND
      payment attempts from Cashfree.

      Service throws on network/API
      errors, so these failures never
      become an automatic approval.
    */

    const inspection =
      await inspectCashfreeOrder(
        cashfreeOrderId
      );

    const gatewayOrder =
      inspection.gatewayOrder;

    const gatewayStatus =
      inspection.orderStatus;

    const attempts =
      inspection.summary;

    /*
      Check the expected amount
      and currency when verifying
      a successful Cashfree order.
    */

    const verifiedPaid =
      isCashfreePaymentSuccessful(
        gatewayOrder,
        order.grandTotal
      );

    /*
      Cross-check the returned
      gateway order ID against
      our stored identifier.
    */

    const gatewayIdMatches =
      String(
        gatewayOrder?.order_id || ''
      ) === cashfreeOrderId;

    if (!gatewayIdMatches) {

      throw error(
        409,
        'Cashfree order identity mismatch. Manual review required.'
      );

    }

    /*
      A pending payment attempt
      is not equivalent to a failed
      or expired payment.
    */

    let recommendation =
      'MANUAL_REVIEW_REQUIRED';

    let message =
      'Do not cancel automatically. Manual payment review is required.';

    if (
      verifiedPaid ||
      order.paymentStatus === 'SUCCESS' ||
      attempts.hasSuccessfulPayment
    ) {

      recommendation =
        'REFUND_REVIEW_REQUIRED';

      message =
        'Payment success detected. Verify settlement and refund requirements before cancellation.';

    } else if (
      attempts.hasPendingPayment
    ) {

      recommendation =
        'WAIT_FOR_PAYMENT_RESOLUTION';

      message =
        'At least one payment attempt is pending. Do not release stock or cancel yet.';

    } else if (
      inspection.terminal &&
      !attempts.hasSuccessfulPayment &&
      !attempts.hasPendingPayment &&
      order.paymentStatus !== 'SUCCESS'
    ) {

      recommendation =
        'ELIGIBLE_FOR_MANUAL_REVIEW';

      message =
        'Cashfree order is terminal with no reported successful or pending attempts. Admin may review cancellation, but cancellation is not performed here.';

    }

    /*
      Return only the information
      needed for Admin review.

      Do not return payment attempt
      objects, gateway credentials,
      or personal payment details.
    */

    return ok(res, {

      message:
        'Cashfree verification completed.',

      order: {

        id: order._id,

        orderId: order.orderId,

        orderStatus:
          order.orderStatus,

        paymentMethod:
          order.paymentMethod,

        paymentStatus:
          order.paymentStatus,

        grandTotal:
          order.grandTotal,

        stockReserved:
          order.stockReserved === true

      },

      cancellationRequest: {

        submittedAt:
          cancellationRequest.changedAt,

        requestReceived: true

      },

      cashfree: {

        orderId:
          cashfreeOrderId,

        environmentOrderStatus:
          gatewayStatus,

        paymentConfirmed:
          verifiedPaid,

        identityVerified:
          gatewayIdMatches,

        terminal:
          inspection.terminal,

        totalAttempts:
          attempts.totalAttempts,

        successfulAttempts:
          attempts.successful,

        pendingAttempts:
          attempts.pending,

        failedAttempts:
          attempts.failed,

        otherAttempts:
          attempts.other

      },

      review: {

        recommendation,

        message,

        automaticCancellationAllowed:
          false,

        refundInitiated:
          false,

        stockReleased:
          false,

        orderModified:
          false

      }

    });

  });


/* =====================================
   EXPORT
===================================== */

module.exports = {
  verifyCancellationPayment
};
