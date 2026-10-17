
/*
=========================================
 MEMORA CREATIONS
 CASHFREE WEBHOOK CONTROLLER

 SECURITY:
 - Raw body verification
 - Cashfree signature verification
 - Payment success event verification
 - Cashfree API confirmation
 - Amount and currency verification
 - Duplicate webhook protection
 - Atomic payment confirmation
 - Cancelled order protection
 - Late payment manual review
 - No automatic stock release
=========================================
*/

const {
  Order
} = require('../models');

const {
  verifyCashfreeWebhook
} = require('../services/cashfreeWebhookService');

const {
  fetchCashfreeOrder,
  isCashfreePaymentSuccessful
} = require('../services/cashfreeService');


/* =====================================
   RESPONSE HELPER
===================================== */

function respond(res, status, message) {

  return res.status(status).json({
    success:
      status >= 200 && status < 300,
    message
  });

}


/* =====================================
   CASHFREE WEBHOOK
===================================== */

async function cashfreeWebhook(req, res) {

  try {

    /*
      1. Raw body required.

      Signature must be validated
      against the original bytes.
    */

    const rawBody = req.body;

    if (!Buffer.isBuffer(rawBody)) {

      return respond(
        res,
        400,
        'Invalid webhook body.'
      );

    }


    /*
      2. Verify Cashfree signature.
    */

    const signature =
      req.headers['x-webhook-signature'];

    const timestamp =
      req.headers['x-webhook-timestamp'];

    const validSignature =
      verifyCashfreeWebhook({
        rawBody,
        signature,
        timestamp
      });

    if (!validSignature) {

      console.warn(
        'Cashfree webhook signature rejected.'
      );

      return respond(
        res,
        401,
        'Invalid Cashfree webhook signature.'
      );

    }


    /*
      3. Parse verified payload.
    */

    let event;

    try {

      event = JSON.parse(
        rawBody.toString('utf8')
      );

    } catch (_) {

      return respond(
        res,
        400,
        'Invalid webhook JSON.'
      );

    }


    /*
      4. Only successful payment
      events confirm an order.

      Failed payments must NOT
      automatically cancel orders
      or release stock.
    */

    if (
      event?.type !==
      'PAYMENT_SUCCESS_WEBHOOK'
    ) {

      return respond(
        res,
        200,
        'Webhook event acknowledged.'
      );

    }


    /*
      5. Validate payment data.
    */

    const payment =
      event.data?.payment;

    const gatewayOrderId =
      String(
        event.data?.order?.order_id || ''
      ).trim();

    if (
      !gatewayOrderId ||
      payment?.payment_status !== 'SUCCESS'
    ) {

      return respond(
        res,
        400,
        'Invalid payment success event.'
      );

    }


    /*
      6. Locate local order.
    */

    const order = await Order.findOne({
      cashfreeOrderId: gatewayOrderId,
      paymentMethod: 'CASHFREE'
    });

    if (!order) {

      console.warn(
        'Cashfree payment has no matching local order:',
        gatewayOrderId
      );

      return respond(
        res,
        503,
        'Order not available for reconciliation.'
      );

    }


    /*
      7. Verify with Cashfree API.

      Never trust the webhook
      payment status alone.
    */

    const gatewayOrder =
      await fetchCashfreeOrder(
        gatewayOrderId
      );

    if (
      String(gatewayOrder?.order_id || '') !==
      String(order.cashfreeOrderId)
    ) {

      return respond(
        res,
        409,
        'Cashfree order ID mismatch.'
      );

    }


    /*
      8. Check gateway payment,
      exact order amount and INR.
    */

    const paid =
      isCashfreePaymentSuccessful(
        gatewayOrder,
        order.grandTotal
      );

    if (!paid) {

      if (
        gatewayOrder?.order_status === 'PAID'
      ) {

        console.error(
          'Cashfree amount or currency mismatch:',
          order.orderId
        );

        return respond(
          res,
          409,
          'Payment amount requires manual review.'
        );

      }

      return respond(
        res,
        503,
        'Cashfree payment not confirmed yet.'
      );

    }


    /*
      9. Already paid order.

      Protect against duplicate
      webhook processing.
    */

    if (
      order.paymentStatus === 'SUCCESS'
    ) {

      if (
        order.orderStatus === 'Cancelled' ||
        order.stockReserved !== true
      ) {

        console.error(
          'Paid order has inconsistent state:',
          order.orderId
        );

        return respond(
          res,
          409,
          'Paid order requires manual review.'
        );

      }

      return respond(
        res,
        200,
        'Payment already confirmed.'
      );

    }


    /*
      10. Do not confirm payment
      for cancelled/unreserved
      or non-pending orders.

      A late successful payment
      needs manual reconciliation.
    */

    if (
      order.orderStatus === 'Cancelled' ||
      order.stockReserved !== true ||
      order.paymentStatus !== 'PENDING'
    ) {

      console.error(
        'Late Cashfree payment requires reconciliation:',
        order.orderId
      );

      return respond(
        res,
        409,
        'Payment requires manual review.'
      );

    }


    /*
      11. Build atomic update.

      Browser verification and
      webhook may arrive together.

      Only one can change
      PENDING to SUCCESS.
    */

    const update = {

      $set: {
        paymentStatus: 'SUCCESS'
      },

      $push: {

        statusHistory: {

          status: order.orderStatus,

          note:
            'Cashfree payment confirmed by verified webhook.',

          changedAt: new Date()

        }

      }

    };

    if (
      payment.cf_payment_id != null
    ) {

      update.$set.cashfreePaymentId =
        String(payment.cf_payment_id);

    }


    /*
      12. Conditional atomic update.

      Cancelled orders are excluded.
      Released stock is excluded.
      Already confirmed payments
      are excluded.
    */

    const updatedOrder =
      await Order.findOneAndUpdate(

        {

          _id: order._id,

          paymentMethod: 'CASHFREE',

          cashfreeOrderId: gatewayOrderId,

          paymentStatus: 'PENDING',

          stockReserved: true,

          orderStatus: {
            $ne: 'Cancelled'
          }

        },

        update,

        {
          new: true
        }

      );


    /*
      13. If update did not apply,
      reload the order.

      Another payment verification
      may already have completed.
    */

    const finalOrder =
      updatedOrder ||
      await Order.findById(
        order._id
      );

    if (
      !finalOrder ||
      finalOrder.paymentStatus !== 'SUCCESS' ||
      finalOrder.orderStatus === 'Cancelled' ||
      finalOrder.stockReserved !== true
    ) {

      console.error(
        'Cashfree reconciliation required:',
        order.orderId
      );

      return respond(
        res,
        409,
        'Payment requires manual review.'
      );

    }


    /*
      14. Do not clear the cart
      from a delayed webhook.

      Do not change stock here.

      Do not approve cancellations
      from webhook events.
    */

    return respond(
      res,
      200,
      'Cashfree payment confirmed.'
    );

  } catch (err) {

    console.error(
      'Cashfree webhook processing error:',
      err.message
    );

    return respond(
      res,
      500,
      'Webhook processing failed.'
    );

  }

}


/* =====================================
   EXPORT
===================================== */

module.exports = {
  cashfreeWebhook
};
