
/*
  MEMORA CREATIONS
  ORDER CONTROLLER

  COD + CASHFREE + RAZORPAY
  Safe cancellation handling
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

const {
  fetchCashfreeOrder,
  isCashfreePaymentSuccessful
} = require('../services/cashfreeService');


/* =====================================
   ORDER PREVIEW
===================================== */

const preview = asyncHandler(async (req, res) => {

  const trusted = await getTrustedItems(
    req.body.items
  );

  const amount = totals(trusted);

  const items = trusted.map(item => ({
    productId: item.product.productId,
    _id: item.product._id,
    name: item.product.name,
    imageUrl: item.product.images?.[0]?.url || '',
    quantity: item.quantity,
    unitPrice: item.product.sellingPrice,
    lineTotal:
      item.product.sellingPrice * item.quantity
  }));

  return ok(res, {
    ...amount,
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
    throw error(400, validationMessage);
  }

  const order = await createCodOrder({
    user: req.user,
    address,
    items: req.body.items,
    clearCart: req.body.clearCart === true
  });

  return ok(
    res,
    {
      message: 'COD order placed successfully.',
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
    user: req.user._id
  })
    .sort({ createdAt: -1 })
    .lean();

  return ok(res, { orders });

});


/* =====================================
   GET SINGLE ORDER
===================================== */

const getOrder = asyncHandler(async (req, res) => {

  const order = await Order.findOne({
    _id: req.params.id,
    user: req.user._id
  }).lean();

  if (!order) {
    throw error(404, 'Order not found.');
  }

  return ok(res, { order });

});


/* =====================================
   CANCEL ORDER

   COD:
   Cancel before dispatch.

   CASHFREE:
   Confirm gateway status first.
   Pending active payments cannot be
   cancelled until gateway expiry.

   RAZORPAY:
   Unpaid cancellation requires a
   separate gateway-safe flow.
===================================== */

const cancelOrder = asyncHandler(async (req, res) => {

  const order = await Order.findOne({
    _id: req.params.id,
    user: req.user._id
  });

  if (!order) {
    throw error(404, 'Order not found.');
  }

  if (
    !['Order Placed', 'Confirmed']
      .includes(order.orderStatus)
  ) {
    throw error(
      400,
      'This order can no longer be cancelled.'
    );
  }

  if (order.orderStatus === 'Cancelled') {
    throw error(409, 'Order already cancelled.');
  }

  /* =================================
     CASHFREE PAYMENT VALIDATION
  ================================= */

  if (order.paymentMethod === 'CASHFREE') {

    if (!order.cashfreeOrderId) {
      throw error(
        409,
        'Cashfree reference missing. Contact support.'
      );
    }

    const gatewayOrder = await fetchCashfreeOrder(
      order.cashfreeOrderId
    );

    if (
      gatewayOrder.order_id !== order.cashfreeOrderId
    ) {
      throw error(
        409,
        'Cashfree order mismatch.'
      );
    }

    const paid = isCashfreePaymentSuccessful(
      gatewayOrder,
      order.grandTotal
    );

    if (
      paid ||
      gatewayOrder.order_status === 'PAID' ||
      order.paymentStatus === 'SUCCESS'
    ) {
      throw error(
        409,
        'Paid online orders require support assistance for cancellation and refund.'
      );
    }

    // ACTIVE payments may still succeed.
    // Do not release reserved stock yet.

    if (gatewayOrder.order_status !== 'EXPIRED') {
      throw error(
        409,
        'Payment is still active or awaiting confirmation. Please contact support.'
      );
    }

  }

  /* =================================
     LEGACY RAZORPAY PROTECTION
  ================================= */

  if (order.paymentMethod === 'RAZORPAY') {

    throw error(
      409,
      'Razorpay orders require support-assisted cancellation.'
    );

  }

  /* =================================
     COD PAYMENT PROTECTION
  ================================= */

  if (
    order.paymentMethod === 'COD' &&
    order.paymentStatus !== 'COD_PENDING'
  ) {
    throw error(
      409,
      'This COD order requires support assistance.'
    );
  }

  /* =================================
     DATABASE TRANSACTION
  ================================= */

  const session = await mongoose.startSession();

  let cancelledOrder;

  try {

    await session.withTransaction(async () => {

      // Read again inside the transaction,
      // because status may have changed.

      const freshOrder = await Order.findOne({
        _id: order._id,
        user: req.user._id
      }).session(session);

      if (!freshOrder) {
        throw error(404, 'Order not found.');
      }

      if (
        !['Order Placed', 'Confirmed']
          .includes(freshOrder.orderStatus)
      ) {
        throw error(
          409,
          'Order status changed. Refresh and retry.'
        );
      }

      if (
        freshOrder.paymentMethod !==
        order.paymentMethod
      ) {
        throw error(
          409,
          'Payment method changed.'
        );
      }

      if (
        freshOrder.paymentMethod === 'CASHFREE' &&
        (
          freshOrder.paymentStatus === 'SUCCESS' ||
          !['PENDING', 'FAILED']
            .includes(freshOrder.paymentStatus)
        )
      ) {
        throw error(
          409,
          'Payment status changed. Cancellation stopped.'
        );
      }

      if (
        freshOrder.paymentMethod === 'COD' &&
        freshOrder.paymentStatus !== 'COD_PENDING'
      ) {
        throw error(
          409,
          'COD payment status changed.'
        );
      }

      const previousStatus = freshOrder.orderStatus;

      // Return reserved stock safely within
      // the same database transaction.

      await releaseStock(
        freshOrder,
        session
      );

      freshOrder.orderStatus = 'Cancelled';

      if (
        freshOrder.paymentMethod === 'CASHFREE'
      ) {
        freshOrder.paymentStatus = 'CANCELLED';
      } else if (
        freshOrder.paymentMethod === 'COD'
      ) {
        freshOrder.paymentStatus = 'CANCELLED';
      }

      freshOrder.statusHistory.push({
        status: 'Cancelled',
        note:
          'Cancelled by customer. Previous status: ' +
          previousStatus,
        changedAt: new Date()
      });

      await freshOrder.save({ session });

      cancelledOrder = freshOrder;

    });

  } finally {

    await session.endSession();

  }

  return ok(res, {
    message: 'Order cancelled successfully.',
    order: cancelledOrder
  });

});


/* =====================================
   EXPORT
===================================== */

module.exports = {
  preview,
  createCod,
  listOrders,
  getOrder,
  cancelOrder
};
