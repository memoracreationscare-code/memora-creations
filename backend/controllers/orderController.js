
'use strict';

/*
=========================================
 MEMORA CREATIONS
 ORDER CONTROLLER

 COD + CASHFREE + LEGACY RAZORPAY

 Safe Order Management
 Payment Protection
 Stock Protection
 Coupon Protection
 WhatsApp Consent Support
 Gift Wrapping Preparation
=========================================
*/

const mongoose = require('mongoose');

const {
  releaseCoupon
} = require('../services/couponUsageService');

const {
  Order
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
  calculateCouponPricing
} = require('../services/couponPricingService');

const {
  prepareGiftWrapping
} = require('../services/giftWrappingService');

const {
  getTrustedItems,
  createCodOrder,
  releaseStock
} = require('../services/orderService');


/* =====================================
   VALIDATE GIFT WRAPPING

   Server controls availability
   and price, not browser input.
===================================== */

function getGiftWrapping(value) {
  try {
    return prepareGiftWrapping(value);
  } catch (err) {
    throw error(
      400,
      err.message ||
      'Invalid gift wrapping details.'
    );
  }
}


/* =====================================
   ORDER PREVIEW

   Product + Delivery + Coupon
   + Gift Wrapping

   Nothing is charged here.
===================================== */

const preview = asyncHandler(
  async (req, res) => {

    const trustedItems =
      await getTrustedItems(
        req.body.items
      );

    const giftWrapping =
      getGiftWrapping(
        req.body.giftWrapping
      );

    /*
      Unified pricing keeps
      preview consistent for
      coupon and non-coupon orders.
    */

    const amountDetails =
      await calculateCouponPricing({
        items: req.body.items,

        couponCode:
          typeof req.body.couponCode === 'string'
            ? req.body.couponCode
            : null,

        userId: req.user._id,

        giftWrapping
      });

    const items = trustedItems.map(
      item => ({
        productId:
          item.product.productId,

        _id:
          item.product._id,

        name:
          item.product.name,

        imageUrl:
          item.product.images?.[0]?.url || '',

        quantity:
          item.quantity,

        unitPrice:
          item.product.sellingPrice,

        lineTotal:
          item.product.sellingPrice *
          item.quantity
      })
    );

    return ok(res, {
      ...amountDetails,
      items
    });

  }
);


/* =====================================
   CREATE COD ORDER

   WhatsApp Consent
   Coupon Support
   Gift Wrapping Support
===================================== */

const createCod = asyncHandler(
  async (req, res) => {

    const address =
      req.body.address;

    const validationMessage =
      validateAddress(address);

    if (validationMessage) {
      throw error(
        400,
        validationMessage
      );
    }

    /*
      Explicit consent only.
      Missing / disabled checkbox
      means false.
    */

    const whatsappOptIn =
      req.body.whatsappOptIn === true;

    /*
      Validate gift wrapping
      before starting the
      order transaction.
    */

    const giftWrapping =
      getGiftWrapping(
        req.body.giftWrapping
      );

    const order =
      await createCodOrder({

        user:
          req.user,

        address,

        items:
          req.body.items,

        couponCode:
          typeof req.body.couponCode === 'string'
            ? req.body.couponCode
                .trim()
                .toUpperCase()
            : null,

        clearCart:
          req.body.clearCart === true,

        whatsappOptIn,

        giftWrapping

      });

    /*
      WhatsApp notification sending
      is not active yet.
    */

    return ok(
      res,
      {
        message:
          'COD order placed successfully.',

        order
      },
      201
    );

  }
);


/* =====================================
   GET CUSTOMER ORDERS
===================================== */

const listOrders = asyncHandler(
  async (req, res) => {

    const orders = await Order.find({
      user: req.user._id
    })
      .sort({
        createdAt: -1
      })
      .lean();

    return ok(res, {
      orders
    });

  }
);


/* =====================================
   GET SINGLE ORDER
===================================== */

const getOrder = asyncHandler(
  async (req, res) => {

    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id
    }).lean();

    if (!order) {
      throw error(
        404,
        'Order not found.'
      );
    }

    return ok(res, {
      order
    });

  }
);


/* =====================================
   CANCEL ORDER

   SECURITY RULES

   1. Only order owner can cancel.
   2. Only eligible COD orders
      are cancelled automatically.
   3. Cashfree cancellation needs
      separate review.
   4. Legacy Razorpay cancellation
      needs support.
   5. Stock + coupon are released
      inside one DB transaction.
   6. Duplicate cancellation blocked.
===================================== */

const cancelOrder = asyncHandler(
  async (req, res) => {

    const order = await Order.findOne({

      _id:
        req.params.id,

      user:
        req.user._id

    });

    if (!order) {
      throw error(
        404,
        'Order not found.'
      );
    }


    /* CHECK ORDER STATUS */

    if (
      order.orderStatus === 'Cancelled'
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
      ].includes(order.orderStatus)
    ) {
      throw error(
        400,
        'This order can no longer be cancelled.'
      );
    }


    /* CASHFREE PROTECTION */

    if (
      order.paymentMethod === 'CASHFREE'
    ) {
      throw error(
        409,
        'Cashfree orders require support-assisted cancellation. Please contact customer care.'
      );
    }


    /* LEGACY RAZORPAY PROTECTION */

    if (
      order.paymentMethod === 'RAZORPAY'
    ) {
      throw error(
        409,
        'Online payment orders require support-assisted cancellation.'
      );
    }


    /* ALLOW COD ONLY */

    if (
      order.paymentMethod !== 'COD'
    ) {
      throw error(
        400,
        'Unsupported payment method.'
      );
    }


    /* CHECK COD PAYMENT STATUS */

    if (
      order.paymentStatus !== 'COD_PENDING'
    ) {
      throw error(
        409,
        'This COD order cannot be cancelled automatically.'
      );
    }


    /* DATABASE TRANSACTION */

    const session =
      await mongoose.startSession();

    let cancelledOrder = null;

    try {

      await session.withTransaction(
        async () => {

          /*
            Re-read order inside
            transaction to avoid
            stale order status.
          */

          const freshOrder =
            await Order.findOne({

              _id:
                order._id,

              user:
                req.user._id

            }).session(session);

          if (!freshOrder) {
            throw error(
              404,
              'Order not found.'
            );
          }


          /* RECHECK ORDER STATUS */

          if (
            ![
              'Order Placed',
              'Confirmed'
            ].includes(
              freshOrder.orderStatus
            )
          ) {
            throw error(
              409,
              'Order status has changed. Please refresh.'
            );
          }


          /* RECHECK PAYMENT */

          if (
            freshOrder.paymentMethod !== 'COD' ||
            freshOrder.paymentStatus !== 'COD_PENDING'
          ) {
            throw error(
              409,
              'Payment details changed. Cancellation stopped.'
            );
          }


          /* RELEASE STOCK */

          await releaseStock(
            freshOrder,
            session
          );


          /*
            RELEASE RESERVED COUPON

            Only once, inside
            the same transaction.
          */

          if (
            freshOrder.couponUsageReserved === true
          ) {

            if (!freshOrder.coupon) {
              throw error(
                409,
                'Order coupon reservation is incomplete.'
              );
            }

            await releaseCoupon({

              couponId:
                freshOrder.coupon,

              userId:
                freshOrder.user,

              session

            });

            freshOrder.couponUsageReserved =
              false;
          }


          /* UPDATE ORDER STATUS */

          freshOrder.orderStatus =
            'Cancelled';

          freshOrder.paymentStatus =
            'CANCELLED';


          /* SAVE STATUS HISTORY */

          freshOrder.statusHistory.push({

            status:
              'Cancelled',

            note:
              'COD order cancelled by customer.',

            changedAt:
              new Date()

          });


          /* SAVE ORDER */

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


    /* FINAL RESPONSE */

    return ok(res, {

      message:
        'Order cancelled successfully.',

      order:
        cancelledOrder

    });

  }
);


/* =====================================
   EXPORT FUNCTIONS
===================================== */

module.exports = {

  preview,

  createCod,

  listOrders,

  getOrder,

  cancelOrder

};
