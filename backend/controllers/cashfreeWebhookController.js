
/* =========================================
   MEMORA CREATIONS
   CASHFREE WEBHOOK CONTROLLER
========================================= */

const {
  Order,
  Cart
} = require('../models');

const {
  verifyCashfreeWebhook
} = require('../services/cashfreeWebhookService');

const {
  fetchCashfreeOrder,
  isCashfreePaymentSuccessful
} = require('../services/cashfreeService');


/* =========================================
   CASHFREE WEBHOOK HANDLER
========================================= */

async function cashfreeWebhook(req, res) {

  try {

    /* =====================================
       1. VERIFY SIGNATURE
    ===================================== */

    const signature =
      req.headers['x-webhook-signature'];

    const timestamp =
      req.headers['x-webhook-timestamp'];

    const rawBody = req.body;

    const isValid =
      verifyCashfreeWebhook({
        rawBody,
        signature,
        timestamp
      });

    if (!isValid) {

      return res.status(401).json({
        success: false,
        message: 'Invalid webhook signature.'
      });

    }

    /* =====================================
       2. PARSE WEBHOOK
    ===================================== */

    let event;

    try {

      event = JSON.parse(
        rawBody.toString('utf8')
      );

    } catch (_) {

      return res.status(400).json({
        success: false,
        message: 'Invalid webhook payload.'
      });

    }

    /* =====================================
       3. HANDLE SUCCESS EVENTS ONLY

       Failed or abandoned attempts
       do not immediately cancel orders.
       Late payments may still arrive.
    ===================================== */

    if (
      event.type !==
      'PAYMENT_SUCCESS_WEBHOOK'
    ) {

      return res.status(200).json({
        success: true,
        message: 'Event acknowledged.'
      });

    }

    const payment =
      event.data?.payment;

    const cashfreeOrderId =
      event.data?.order?.order_id;

    if (
      !cashfreeOrderId ||
      payment?.payment_status !== 'SUCCESS'
    ) {

      return res.status(400).json({
        success: false,
        message: 'Invalid payment success event.'
      });

    }

    /* =====================================
       4. FIND MERCHANT ORDER
    ===================================== */

    const order = await Order.findOne({
      cashfreeOrderId:
        String(cashfreeOrderId),

      paymentMethod:
        'CASHFREE'
    });

    if (!order) {

      // Retry is preferable to losing a
      // legitimate payment notification.

      return res.status(503).json({
        success: false,
        message: 'Order not available yet.'
      });

    }

    /* =====================================
       5. VERIFY DIRECTLY WITH CASHFREE
    ===================================== */

    const cashfreeOrder =
      await fetchCashfreeOrder(
        order.cashfreeOrderId
      );

    if (
      cashfreeOrder.order_id !==
      order.cashfreeOrderId
    ) {

      return res.status(409).json({
        success: false,
        message: 'Payment order mismatch.'
      });

    }

    const isPaid =
      isCashfreePaymentSuccessful(
        cashfreeOrder,
        order.grandTotal
      );

    if (!isPaid) {

      // Do not mark an unpaid order
      // as successful.

      return res.status(503).json({
        success: false,
        message: 'Payment not confirmed yet.'
      });

    }

    /* =====================================
       6. ALREADY VERIFIED?
    ===================================== */

    if (
      order.paymentStatus === 'SUCCESS'
    ) {

      return res.status(200).json({
        success: true,
        message: 'Payment already confirmed.'
      });

    }

    /* =====================================
       7. PROTECT CANCELLED ORDERS
    ===================================== */

    if (
      order.orderStatus === 'Cancelled' ||
      order.stockReserved !== true
    ) {

      console.error(
        'Cashfree manual review required:',
        order.orderId
      );

      return res.status(409).json({
        success: false,
        message: 'Paid order requires manual review.'
      });

    }

    /* =====================================
       8. CONFIRM PAYMENT ATOMICALLY

       Only one request can change an
       unpaid order into SUCCESS.
    ===================================== */

    const updatedOrder =
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
              'SUCCESS',

            cashfreePaymentId:
              payment.cf_payment_id
                ? String(payment.cf_payment_id)
                : undefined
          },

          $push: {
            statusHistory: {
              status: 'Order Placed',

              note:
                'Cashfree payment confirmed by verified webhook.',

              changedAt:
                new Date()
            }
          }
        },

        {
          new: true
        }
      );

    /* =====================================
       9. CONFIRM FINAL DATABASE STATE
    ===================================== */

    const confirmedOrder =
      updatedOrder ||
      await Order.findById(order._id);

    if (
      !confirmedOrder ||
      confirmedOrder.paymentStatus !== 'SUCCESS'
    ) {

      return res.status(503).json({
        success: false,
        message: 'Payment update could not be completed.'
      });

    }

    /* =====================================
       10. CLEAR CART AFTER SUCCESS
    ===================================== */

    if (
      confirmedOrder.clearCartOnPayment === true
    ) {

      await Cart.updateOne(
        {
          user: confirmedOrder.user
        },
        {
          $set: {
            items: []
          }
        }
      );

    }

    /* =====================================
       11. ACKNOWLEDGE WEBHOOK
    ===================================== */

    return res.status(200).json({
      success: true,
      message: 'Cashfree payment confirmed.'
    });

  } catch (err) {

    console.error(
      'Cashfree webhook processing error:',
      err.message
    );

    return res.status(500).json({
      success: false,
      message: 'Webhook processing failed.'
    });

  }

}


/* =========================================
   EXPORT
========================================= */

module.exports = {
  cashfreeWebhook
};
