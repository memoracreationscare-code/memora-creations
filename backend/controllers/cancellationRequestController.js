
/*
=========================================
 MEMORA CREATIONS
 CASHFREE CANCELLATION REQUEST

 Customer can REQUEST cancellation.

 IMPORTANT:
 - Does not cancel the order
 - Does not change payment status
 - Does not release stock
 - Does not initiate a refund
 - Prevents duplicate requests
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


/* =====================================
   INTERNAL REQUEST MARKER
===================================== */

const REQUEST_MARKER =
  'CUSTOMER_CASHFREE_CANCEL_REQUEST';


/* =====================================
   REQUEST CASHFREE CANCELLATION

   POST /api/orders/:id/cancel-request

   Requires logged-in customer.
===================================== */

const requestCancellation = asyncHandler(
  async (req, res) => {

    const orderId = req.params.id;

    const userId = req.user?._id;

    if (!userId) {
      throw error(
        401,
        'Please login to continue.'
      );
    }

    if (!mongoose.isValidObjectId(orderId)) {
      throw error(
        400,
        'Invalid order ID.'
      );
    }

    /*
      AUTOMATIC PATH

      Unpaid orders, and paid orders when
      AUTO_REFUND_ENABLED=true, are cancelled
      (and refunded) right away. Otherwise the
      old "request for admin review" path runs.
    */

    const candidate = await Order.findOne({
      _id: orderId,
      user: userId
    });

    if (
      candidate &&
      candidate.paymentMethod === 'CASHFREE' &&
      ['Order Placed', 'Confirmed'].includes(candidate.orderStatus)
    ) {
      try {
        const cancelled =
          await require('../services/orderCancellation')
            .autoCancelOrder(candidate);

        const refund = cancelled.autoCancel?.refundStatus;

        return ok(res, {
          message:
            refund === 'SUBMITTED'
              ? 'Order cancelled. Your refund has been started and usually reaches your account in 5-7 working days.'
              : refund === 'FAILED'
                ? 'Order cancelled. Your refund is being processed by our team.'
                : 'Order cancelled.',

          requestStatus: 'CANCELLED',

          orderId: cancelled.orderId,

          orderStatus: cancelled.orderStatus,

          paymentStatus: cancelled.paymentStatus
        });

      } catch (err) {
        if (err.message !== 'AUTO_REFUND_DISABLED') {
          throw err;
        }
      }
    }

    /*
      Prevent the same customer
      from creating duplicate requests.

      Only pending Cashfree orders
      can receive a cancellation request.

      Stock and payment fields are
      deliberately NOT modified.
    */

    const order = await Order.findOneAndUpdate(
      {
        _id: orderId,

        user: userId,

        paymentMethod: 'CASHFREE',

        paymentStatus: { $in: ['PENDING', 'SUCCESS'] },

        orderStatus: {
          $in: [
            'Order Placed',
            'Confirmed'
          ]
        },

        statusHistory: {
          $not: {
            $elemMatch: {
              note: {
                $regex:
                  '^CUSTOMER_CASHFREE_CANCEL_REQUEST'
              }
            }
          }
        }
      },
      {
        $push: {
          statusHistory: {
            status: 'Order Placed',

            note:
              REQUEST_MARKER +
              ': MC_PAID_CASHFREE_REQUEST_V1. ' +
              'Customer requested cancellation/refund review. ' +
              'Admin must independently verify Cashfree payment ' +
              'and any refund before changing order or stock.',

            changedAt: new Date()
          }
        }
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (order) {

      return ok(res, {
        message:
          'Request submitted for admin review. ' +
          'No cancellation or refund has been performed.',

        requestStatus: 'REQUESTED',

        orderId: order.orderId,

        orderStatus: order.orderStatus,

        paymentStatus: order.paymentStatus
      });

    }

    /*
      Explain why the request
      could not be created.
    */

    const existing = await Order.findOne({
      _id: orderId,
      user: userId
    }).lean();

    if (!existing) {
      throw error(
        404,
        'Order not found.'
      );
    }

    if (
      existing.paymentMethod !== 'CASHFREE'
    ) {
      throw error(
        400,
        'This request is only for Cashfree orders.'
      );
    }

    if (
      Array.isArray(existing.statusHistory) &&
      existing.statusHistory.some(
        item =>
          String(item.note || '').startsWith(
            REQUEST_MARKER
          )
      )
    ) {

      return ok(res, {
        message:
          'Cancellation request already submitted.',

        requestStatus: 'ALREADY_REQUESTED',

        orderId: existing.orderId
      });

    }

    if (
      existing.orderStatus === 'Cancelled'
    ) {
      throw error(
        409,
        'This order is already cancelled.'
      );
    }

    if (
      ![
        'Order Placed',
        'Confirmed'
      ].includes(existing.orderStatus)
    ) {
      throw error(
        409,
        'This order is already being processed ' +
        'and cannot accept a new cancellation request.'
      );
    }

    throw error(
      409,
      'This order is not eligible for an ' +
      'automatic cancellation request. ' +
      'Please contact customer support.'
    );

  }
);


/* =====================================
   EXPORT
===================================== */

module.exports = {
  requestCancellation
};
