
'use strict';

/*
=========================================
 MEMORA CREATIONS
 CASHFREE PAYMENT CONTROLLER

 SANDBOX + PRODUCTION
 PAYMENT VERIFICATION
 DUPLICATE PAYMENT PROTECTION
 ORDER SECURITY
 COUPON SUPPORT
 WHATSAPP CONSENT
 GIFT WRAPPING PREPARATION
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
  createCashfreePendingOrder
} = require('../services/orderService');

const {
  calculateCouponPricing
} = require('../services/couponPricingService');

const {
  prepareGiftWrapping
} = require('../services/giftWrappingService');

const {
  getCashfreeConfig,
  createCashfreeOrder,
  fetchCashfreeOrder,
  isCashfreePaymentSuccessful
} = require('../services/cashfreeService');


/* =====================================
   VALIDATE GIFT WRAPPING

   Always use the server service.
   Never accept browser-calculated fees.
===================================== */

function getGiftWrapping(value) {
  try {
    return prepareGiftWrapping(value);
  } catch (err) {
    throw error(
      400,
      err.message ||
        'Invalid gift wrapping selection.'
    );
  }
}


/* =====================================
   CREATE CASHFREE ORDER
===================================== */

const createOrder = asyncHandler(
  async (req, res) => {

    const address =
      req.body?.address;

    const validationMessage =
      validateAddress(address);

    if (validationMessage) {
      throw error(
        400,
        validationMessage
      );
    }

    const items =
      req.body?.items;


    /* TRUSTED GIFT WRAPPING */

    const giftWrapping =
      getGiftWrapping(
        req.body?.giftWrapping
      );


    /* COUPON */

    const couponCode =
      typeof req.body?.couponCode === 'string'
        ? req.body.couponCode
            .trim()
            .toUpperCase()
        : null;


    /*
      Server calculates the price
      using database product prices,
      delivery charge, coupon and
      gift wrapping configuration.
    */

    const amountDetails =
      await calculateCouponPricing({
        items,
        couponCode,
        userId: req.user._id,
        giftWrapping
      });

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
      WHATSAPP CONSENT

      Only explicit true counts.
      No messages are sent here.
    */

    const whatsappOptIn =
      req.body?.whatsappOptIn === true;


    /*
      UNIQUE CASHFREE REFERENCE
    */

    const cashfreeOrderId =
      'MC_CF_' +
      Date.now() +
      '_' +
      crypto.randomBytes(8)
        .toString('hex');


    /* CASHFREE CONFIG */

    const config =
      getCashfreeConfig();


    /*
      CREATE PAYMENT SESSION

      Amount includes the trusted
      gift wrapping fee, if enabled.
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


    /* VALIDATE GATEWAY RESPONSE */

    if (
      !cashfreeOrder ||
      !cashfreeOrder.payment_session_id ||
      cashfreeOrder.order_id !==
        cashfreeOrderId
    ) {
      throw error(
        502,
        'Cashfree payment session could not be created.'
      );
    }


    /*
      Verify gateway amount
      and currency.
    */

    if (
      Math.round(
        Number(
          cashfreeOrder.order_amount
        ) * 100
      ) !==
        Math.round(amount * 100) ||
      cashfreeOrder.order_currency !== 'INR'
    ) {
      throw error(
        502,
        'Cashfree gateway amount mismatch.'
      );
    }


    /*
      CREATE PENDING LOCAL ORDER

      The order service independently
      recalculates the final amount.

      If the amount differs,
      the transaction is rejected.
    */

    const order =
      await createCashfreePendingOrder({

        user:
          req.user,

        address,

        items,

        cashfreeOrderId,

        couponCode,

        expectedAmount:
          amount,

        clearCart:
          req.body?.clearCart === true,

        whatsappOptIn,

        giftWrapping

      });


    /*
      STORE CASHFREE CF ORDER ID
    */

    if (cashfreeOrder.cf_order_id) {

      await Order.updateOne(
        {
          _id:
            order._id
        },
        {
          $set: {
            cashfreeCfOrderId:
              String(
                cashfreeOrder.cf_order_id
              )
          }
        }
      );

    }


    /*
      RETURN PAYMENT SESSION

      Never expose Cashfree secrets.
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

   Only gateway API can confirm
   payment success.
===================================== */

const verifyPayment = asyncHandler(
  async (req, res) => {

    const orderId =
      req.body?.orderId;

    if (
      !orderId ||
      !mongoose.isValidObjectId(
        orderId
      )
    ) {
      throw error(
        400,
        'Valid order ID is required.'
      );
    }


    /*
      Customer can verify only
      their own Cashfree order.
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
      FETCH AUTHORITATIVE STATUS
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
      VALIDATE PAYMENT AMOUNT,
      CURRENCY AND PAID STATUS

      order.grandTotal includes any
      server-approved gift wrapping fee.
    */

    const paid =
      isCashfreePaymentSuccessful(
        gatewayOrder,
        order.grandTotal
      );


    /*
      Paid with an invalid amount
      requires manual review.
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
      PAYMENT NOT CONFIRMED

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
      ATOMIC PAYMENT CONFIRMATION

      Webhook and browser verification
      may run simultaneously.

      Only a reserved, non-cancelled
      order can become SUCCESS.
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
      RELOAD DATABASE STATE

      Webhook may have already
      completed the transition.
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
      Do not report success
      for an invalid order.
    */

    if (
      !confirmedOrder ||
      confirmedOrder.paymentStatus !==
        'SUCCESS' ||
      confirmedOrder.orderStatus ===
        'Cancelled' ||
      confirmedOrder.stockReserved !==
        true
    ) {
      throw error(
        409,
        'Payment received, but order requires manual review.'
      );
    }


    /*
      CLEAR CART ONLY AFTER
      VERIFIED PAYMENT SUCCESS
    */

    if (
      confirmedOrder.clearCartOnPayment ===
      true
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
      PAYMENT CONFIRMED

      WhatsApp dispatch is not
      enabled here.
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
