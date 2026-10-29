
/*
=========================================
 MEMORA CREATIONS
 ORDER CONTROLLER

 COD + CASHFREE + RAZORPAY

 Safe Order Management
 Payment Protection
 Stock Protection
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
  validateAddress
} = require('../utils/validation');

const {
  getTrustedItems,
  totals,
  createCodOrder,
  releaseStock
} = require('../services/orderService');


/* =====================================
   ORDER PREVIEW
===================================== */

const preview = asyncHandler(async (req, res) => {

  const trustedItems = await getTrustedItems(
    req.body.items
  );

  const amountDetails = totals(trustedItems);

  const items = trustedItems.map(item => ({

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
      item.product.sellingPrice * item.quantity

  }));

  return ok(res, {

    ...amountDetails,

    items

  });

});


/* =====================================
   CREATE COD ORDER
===================================== */

const createCod = asyncHandler(async (req, res) => {

  const address = req.body.address;

  const validationMessage = validateAddress(
    address
  );

  if (validationMessage) {

    throw error(
      400,
      validationMessage
    );

  }

  const order = await createCodOrder({

    user:
      req.user,

    address,

    items:
      req.body.items,

    // MC_COD_COUPON_CONTROLLER_V1
    // Optional coupon; pricing is recalculated by the backend.
    couponCode: typeof req.body?.couponCode === 'string'
      ? req.body.couponCode.trim().toUpperCase()
      : null,

    clearCart:
      req.body.clearCart === true

  });

  return ok(
    res,
    {
      message:
        'COD order placed successfully.',

      order
    },
    201
  );

});


/* =====================================
   GET CUSTOMER ORDERS
===================================== */

const listOrders = asyncHandler(async (req, res) => {

  const orders = await Order.find({

    user:
      req.user._id

  })
    .sort({
      createdAt: -1
    })
    .lean();

  return ok(res, {

    orders

  });

});


/* =====================================
   GET SINGLE ORDER
===================================== */

const getOrder = asyncHandler(async (req, res) => {

  const order = await Order.findOne({

    _id:
      req.params.id,

    user:
      req.user._id

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

});


/* =====================================
   CANCEL ORDER

   SECURITY RULES:

   1. Only owner can cancel.

   2. COD cancellation supported
      before dispatch.

   3. Cashfree cancellation requires
      a separate gateway-safe flow.

   4. Razorpay legacy cancellation
      requires support.

   5. Stock release and cancellation
      run in one DB transaction.

   6. Duplicate cancellation blocked.
===================================== */

const cancelOrder = asyncHandler(async (req, res) => {

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


  /* =================================
     CHECK ORDER STATUS
  ================================= */

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


  /* =================================
     CASHFREE PROTECTION

     Customer-side cancellation is
     temporarily disabled to prevent
     late-payment race conditions.
  ================================= */

  if (
    order.paymentMethod === 'CASHFREE'
  ) {

    throw error(
      409,
      'Cashfree orders require support-assisted cancellation. Please contact customer care.'
    );

  }


  /* =================================
     RAZORPAY PROTECTION
  ================================= */

  if (
    order.paymentMethod === 'RAZORPAY'
  ) {

    throw error(
      409,
      'Online payment orders require support-assisted cancellation.'
    );

  }


  /* =================================
     ALLOW COD ONLY
  ================================= */

  if (
    order.paymentMethod !== 'COD'
  ) {

    throw error(
      400,
      'Unsupported payment method.'
    );

  }


  /* =================================
     CHECK COD PAYMENT STATUS
  ================================= */

  if (
    order.paymentStatus !== 'COD_PENDING'
  ) {

    throw error(
      409,
      'This COD order cannot be cancelled automatically.'
    );

  }


  /* =================================
     DATABASE TRANSACTION
  ================================= */

  const session = await mongoose.startSession();

  let cancelledOrder = null;

  try {

    await session.withTransaction(async () => {

      /*
       Read fresh order inside transaction
       to avoid using stale status.
      */

      const freshOrder = await Order.findOne({

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


      /* =================================
         RECHECK ORDER STATUS
      ================================= */

      if (
        ![
          'Order Placed',
          'Confirmed'
        ].includes(freshOrder.orderStatus)
      ) {

        throw error(
          409,
          'Order status has changed. Please refresh.'
        );

      }


      /* =================================
         RECHECK PAYMENT
      ================================= */

      if (
        freshOrder.paymentMethod !== 'COD' ||
        freshOrder.paymentStatus !== 'COD_PENDING'
      ) {

        throw error(
          409,
          'Payment details changed. Cancellation stopped.'
        );

      }


      /* =================================
         RELEASE RESERVED STOCK
      ================================= */

      await releaseStock(
        freshOrder,
        session
      );


      /* =================================
         UPDATE ORDER
      ================================= */

      freshOrder.orderStatus =
        'Cancelled';

      freshOrder.paymentStatus =
        'CANCELLED';


      /* =================================
         SAVE STATUS HISTORY
      ================================= */

      freshOrder.statusHistory.push({

        status:
          'Cancelled',

        note:
          'COD order cancelled by customer.',

        changedAt:
          new Date()

      });


      /* =================================
         SAVE ORDER
      ================================= */

      await freshOrder.save({

        session

      });

      cancelledOrder =
        freshOrder;

    });

  } finally {

    await session.endSession();

  }


  /* =================================
     FINAL RESPONSE
  ================================= */

  return ok(res, {

    message:
      'Order cancelled successfully.',

    order:
      cancelledOrder

  });

});


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
