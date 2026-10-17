
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

        paymentStatus: 'PENDING',

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
              ': Customer requested cancellation. ' +
              'Admin must verify Cashfree payment ' +
              'before any refund or stock release.',

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
          'Cancellation request submitted. ' +
          'The order has not been cancelled yet.',

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
      existing.paymentStatus === 'SUCCESS'
    ) {
      throw error(
        409,
        'Payment is successful. ' +
        'Cancellation requires refund review.'
      );
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
