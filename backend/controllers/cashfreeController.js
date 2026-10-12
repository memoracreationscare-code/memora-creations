
/* =========================================
   MEMORA CREATIONS
   CASHFREE PAYMENT CONTROLLER
   SANDBOX / PRODUCTION
========================================= */

const crypto = require('crypto');

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


/* =========================================
   CREATE CASHFREE PAYMENT ORDER
========================================= */

const createOrder = asyncHandler(
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

    const items =
      req.body.items;

    // Always calculate prices on the server.

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
        'Invalid order total.'
      );
    }

    const cashfreeOrderId =
      'MC_CF_' +
      Date.now() +
      '_' +
      crypto.randomBytes(5)
        .toString('hex');

    // Create payment session at Cashfree.

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
          req.user.email || undefined

      });

    if (
      !cashfreeOrder ||
      !cashfreeOrder.payment_session_id ||
      cashfreeOrder.order_id !== cashfreeOrderId
    ) {
      throw error(
        502,
        'Cashfree payment session was not created correctly.'
      );
    }

    // Save local order and reserve stock.
    // Existing COD and Razorpay flows stay unchanged.

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

    if (
      cashfreeOrder.cf_order_id
    ) {
      order.cashfreeCfOrderId =
        String(cashfreeOrder.cf_order_id);

      await order.save();
    }

    const config =
      getCashfreeConfig();

    return ok(res, {

      orderId:
        order._id,

      merchantOrderId:
        order.orderId,

      cashfreeOrderId,

      paymentSessionId:
        cashfreeOrder.payment_session_id,

      amount,

      currency:
        'INR',

      mode:
        config.env

    });

  }
);


/* =========================================
   VERIFY CASHFREE PAYMENT

   Never trust payment success from
   the browser alone.

   Confirm directly with Cashfree API.
========================================= */

const verifyPayment = asyncHandler(
  async (req, res) => {

    const orderId =
      req.body.orderId;

    if (!orderId) {
      throw error(
        400,
        'Order ID is required.'
      );
    }

    const order =
      await Order.findOne({

        _id: orderId,

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

    if (
      !order.cashfreeOrderId
    ) {
      throw error(
        400,
        'Cashfree order reference is missing.'
      );
    }

    // Fetch authoritative status
    // directly from Cashfree.

    const cashfreeOrder =
      await fetchCashfreeOrder(
        order.cashfreeOrderId
      );

    if (
      cashfreeOrder.order_id !==
      order.cashfreeOrderId
    ) {
      throw error(
        400,
        'Cashfree order ID mismatch.'
      );
    }

    const isPaid =
      isCashfreePaymentSuccessful(
        cashfreeOrder,
        order.grandTotal
      );

    // Do not confirm an unpaid order.

    if (!isPaid) {

      return ok(res, {

        verified:
          false,

        paymentStatus:
          order.paymentStatus,

        cashfreeStatus:
          cashfreeOrder.order_status ||
          'UNKNOWN',

        message:
          'Payment is not confirmed yet.'

      });

    }

    // Avoid marking the same order
    // successful more than once.

    if (
      order.paymentStatus !== 'SUCCESS'
    ) {

      if (
        order.orderStatus === 'Cancelled' ||
        order.stockReserved !== true
      ) {
        throw error(
          409,
          'Payment received, but this order requires manual review.'
        );
      }

      await Order.findOneAndUpdate(
        {
          _id:
            order._id,

          paymentMethod:
            'CASHFREE',

          paymentStatus: {
            $ne: 'SUCCESS'
          },

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
                'Cashfree payment verified successfully.',

              changedAt:
                new Date()
            }
          }
        },
        {
          new:
            true
        }
      );

    }

    const confirmedOrder =
      await Order.findById(
        order._id
      );

    if (
      !confirmedOrder ||
      confirmedOrder.paymentStatus !== 'SUCCESS'
    ) {
      throw error(
        409,
        'Payment confirmation requires review.'
      );
    }

    // Clear cart after verified payment.

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

    return ok(res, {

      verified:
        true,

      paymentStatus:
        'SUCCESS',

      message:
        'Cashfree payment verified successfully.',

      order:
        confirmedOrder

    });

  }
);


/* =========================================
   EXPORTS
========================================= */

module.exports = {
  createOrder,
  verifyPayment
};
