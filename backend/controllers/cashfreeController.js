
/*
=========================================
 MEMORA CREATIONS
 CASHFREE PAYMENT CONTROLLER

 SANDBOX + PRODUCTION
 PAYMENT VERIFICATION
 DUPLICATE PAYMENT PROTECTION
 ORDER SECURITY
=========================================
*/

const crypto = require('crypto');
const mongoose = require('mongoose');

const {
  Order,
  Cart
} = require('../models');

const {
  asyncHandler,
  error,
  ok
} = require('../utils/http');

const {
  validateAddress
} = require('../utils/validation');

const {
  getTrustedItems,
  totals,
  createCashfreePendingOrder
} = require('../services/orderService');

const {
  getCashfreeConfig,
  createCashfreeOrder,
  fetchCashfreeOrder,
  isCashfreePaymentSuccessful
} = require('../services/cashfreeService');


/* =====================================
   CREATE CASHFREE ORDER
===================================== */

const createOrder = asyncHandler(
  async (req, res) => {

    const address = req.body?.address;

    const validationMessage =
      validateAddress(address);

    if (validationMessage) {
      throw error(
        400,
        validationMessage
      );
    }

    const items = req.body?.items;

    /*
      Prices must always be calculated
      from the database.
    */

    const trustedItems =
      await getTrustedItems(items);

    const amountDetails =
      totals(trustedItems);

    const amount =
      amountDetails.grandTotal;

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      throw error(
        400,
        'Invalid order amount.'
      );
    }

    /*
      Unique Cashfree order reference.
    */

    const cashfreeOrderId =
      'MC_CF_' +
      Date.now() +
      '_' +
      crypto.randomBytes(8)
        .toString('hex');

    /*
      Check gateway configuration before
      creating a payment session.
    */

    const config =
      getCashfreeConfig();

    /*
      Create payment session through
      Cashfree server API.
    */

    const cashfreeOrder =
      await createCashfreeOrder({

        orderId:
          cashfreeOrderId,

        amount,

        customerId:
          String(req.user._id),

        customerName:
          req.user.fullName ||
          address.fullName,

        customerPhone:
          req.user.mobile ||
          address.mobile,

        customerEmail:
          req.user.email ||
          undefined

      });

    /*
      Validate gateway response.
    */

    if (
      !cashfreeOrder ||
      !cashfreeOrder.payment_session_id ||
      cashfreeOrder.order_id !== cashfreeOrderId
    ) {
      throw error(
        502,
        'Cashfree payment session could not be created.'
      );
    }

    /*
      Create local pending order and
      reserve stock inside transaction.

      Important:
      If the local transaction fails,
      the gateway session may remain.
      It must be handled by a separate
      reconciliation workflow.
    */

    const order =
      await createCashfreePendingOrder({

        user:
          req.user,

        address,

        items,

        cashfreeOrderId,

        clearCart:
          req.body.clearCart === true

      });

    /*
      Cashfree reference for reporting.
      The main order is already saved.
    */

    if (cashfreeOrder.cf_order_id) {

      await Order.updateOne(
        {
          _id: order._id
        },
        {
          $set: {
            cashfreeCfOrderId:
              String(cashfreeOrder.cf_order_id)
          }
        }
      );

    }

    /*
      Return the SDK payment session.
      Never expose Cashfree credentials.
    */

    return ok(res, {

      orderId:
        order._id,

      merchantOrderId:
        order.orderId,

      cashfreeOrderId,

      paymentSessionId:
        cashfreeOrder.payment_session_id,

      amount:
        order.grandTotal,

      currency:
        'INR',

      mode:
        config.env

    });

  }
);


/* =====================================
   VERIFY CASHFREE PAYMENT

   Verify only with Cashfree API.
   Never trust browser payment status.
===================================== */

const verifyPayment = asyncHandler(
  async (req, res) => {

    const orderId =
      req.body?.orderId;

    if (
      !orderId ||
      !mongoose.isValidObjectId(orderId)
    ) {
      throw error(
        400,
        'Valid order ID is required.'
      );
    }

    /*
      Customer may verify only
      their own Cashfree orders.
    */

    const order =
      await Order.findOne({

        _id:
          orderId,

        user:
          req.user._id,

        paymentMethod:
          'CASHFREE'

      });

    if (!order) {
      throw error(
        404,
        'Cashfree order not found.'
      );
    }

    if (!order.cashfreeOrderId) {
      throw error(
        409,
        'Cashfree order reference missing.'
      );
    }

    /*
      Fetch authoritative status.
    */

    const gatewayOrder =
      await fetchCashfreeOrder(
        order.cashfreeOrderId
      );

    if (
      gatewayOrder.order_id !==
      order.cashfreeOrderId
    ) {
      throw error(
        409,
        'Cashfree order reference mismatch.'
      );
    }

    /*
      Validate payment amount,
      currency and PAID status.
    */

    const paid =
      isCashfreePaymentSuccessful(
        gatewayOrder,
        order.grandTotal
      );

    /*
      A PAID gateway status with invalid
      amount/currency needs manual review.
    */

    if (
      gatewayOrder.order_status === 'PAID' &&
      !paid
    ) {
      throw error(
        409,
        'Payment requires manual review.'
      );
    }

    /*
      Payment not confirmed.

      Do not release stock here.
      Do not mark SUCCESS.
      Do not clear cart.
    */

    if (!paid) {

      if (
        order.paymentStatus === 'SUCCESS'
      ) {
        throw error(
          409,
          'Payment records require reconciliation.'
        );
      }

      return ok(res, {

        verified:
          false,

        paymentStatus:
          order.paymentStatus,

        cashfreeStatus:
          gatewayOrder.order_status ||
          'UNKNOWN',

        message:
          'Payment is not confirmed yet.'

      });

    }

    /*
      Confirm payment atomically.

      Webhook and browser verification
      may run simultaneously.

      Only a reserved, non-cancelled
      order can transition to SUCCESS.
    */

    const updatedOrder =
      await Order.findOneAndUpdate(

        {

          _id:
            order._id,

          user:
            req.user._id,

          paymentMethod:
            'CASHFREE',

          paymentStatus:
            'PENDING',

          stockReserved:
            true,

          orderStatus: {
            $ne: 'Cancelled'
          }

        },

        {

          $set: {
            paymentStatus:
              'SUCCESS'
          },

          $push: {

            statusHistory: {

              status:
                order.orderStatus,

              note:
                'Cashfree payment confirmed by server verification.',

              changedAt:
                new Date()

            }

          }

        },

        {
          new: true
        }

      );

    /*
      Reload latest database state.

      Webhook may already have completed
      the transition.
    */

    const confirmedOrder =
      updatedOrder ||
      await Order.findOne({

        _id:
          order._id,

        user:
          req.user._id,

        paymentMethod:
          'CASHFREE'

      });

    /*
      Do not report success for a
      cancelled/unreserved order.
    */

    if (
      !confirmedOrder ||
      confirmedOrder.paymentStatus !== 'SUCCESS' ||
      confirmedOrder.orderStatus === 'Cancelled' ||
      confirmedOrder.stockReserved !== true
    ) {
      throw error(
        409,
        'Payment received, but order requires manual review.'
      );
    }

    /*
      Clear cart only after verified
      successful payment.

      This preserves current behavior.
    */

    if (
      confirmedOrder.clearCartOnPayment === true
    ) {

      await Cart.updateOne(
        {
          user:
            req.user._id
        },
        {
          $set: {
            items: []
          }
        }
      );

    }

    /*
      Payment confirmed.
    */

    return ok(res, {

      verified:
        true,

      paymentStatus:
        'SUCCESS',

      cashfreeStatus:
        gatewayOrder.order_status,

      message:
        'Cashfree payment verified successfully.',

      order:
        confirmedOrder

    });

  }
);


/* =====================================
   EXPORTS
===================================== */

module.exports = {

  createOrder,

  verifyPayment

};
