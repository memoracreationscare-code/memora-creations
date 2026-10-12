
/*
=========================================
 MEMORA CREATIONS
 CASHFREE WEBHOOK CONTROLLER

 PAYMENT SECURITY
 SIGNATURE VERIFICATION
 DUPLICATE WEBHOOK PROTECTION
 ATOMIC PAYMENT CONFIRMATION
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
   WEBHOOK RESPONSE HELPER
===================================== */

function webhookResponse(
  res,
  status,
  message
) {

  return res.status(status).json({

    success:
      status >= 200 && status < 300,

    message

  });

}


/* =====================================
   CASHFREE WEBHOOK HANDLER
===================================== */

async function cashfreeWebhook(req, res) {

  try {

    /* =================================
       1. VERIFY RAW REQUEST
    ================================= */

    const rawBody = req.body;

    if (!Buffer.isBuffer(rawBody)) {

      return webhookResponse(
        res,
        400,
        'Invalid webhook body.'
      );

    }


    /* =================================
       2. VERIFY SIGNATURE
    ================================= */

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

      return webhookResponse(
        res,
        401,
        'Invalid webhook signature.'
      );

    }


    /* =================================
       3. PARSE EVENT
    ================================= */

    let event;

    try {

      event = JSON.parse(
        rawBody.toString('utf8')
      );

    } catch (parseError) {

      return webhookResponse(
        res,
        400,
        'Invalid webhook JSON.'
      );

    }


    /* =================================
       4. HANDLE SUPPORTED EVENT

       Failed or dropped payment attempts
       must not automatically release
       stock or cancel an order.

       Late successful payments may arrive.
    ================================= */

    if (
      event?.type !==
      'PAYMENT_SUCCESS_WEBHOOK'
    ) {

      return webhookResponse(
        res,
        200,
        'Webhook event acknowledged.'
      );

    }


    /* =================================
       5. EXTRACT PAYMENT DATA
    ================================= */

    const payment =
      event.data?.payment;

    const gatewayOrderId =
      event.data?.order?.order_id;

    if (
      !gatewayOrderId ||
      payment?.payment_status !== 'SUCCESS'
    ) {

      return webhookResponse(
        res,
        400,
        'Invalid payment success event.'
      );

    }


    /* =================================
       6. FIND LOCAL ORDER
    ================================= */

    const order = await Order.findOne({

      cashfreeOrderId:
        String(gatewayOrderId),

      paymentMethod:
        'CASHFREE'

    });

    if (!order) {

      console.warn(
        'Cashfree order not found:',
        String(gatewayOrderId)
      );

      return webhookResponse(
        res,
        503,
        'Order not available yet.'
      );

    }


    /* =================================
       7. VERIFY WITH CASHFREE API

       Do not trust the webhook payload
       alone for payment confirmation.
    ================================= */

    const gatewayOrder =
      await fetchCashfreeOrder(
        order.cashfreeOrderId
      );

    if (
      gatewayOrder.order_id !==
      order.cashfreeOrderId
    ) {

      return webhookResponse(
        res,
        409,
        'Cashfree order reference mismatch.'
      );

    }


    /* =================================
       8. VERIFY AMOUNT AND CURRENCY
    ================================= */

    const paid =
      isCashfreePaymentSuccessful(

        gatewayOrder,

        order.grandTotal

      );

    if (!paid) {

      console.warn(
        'Cashfree payment not verified:',
        order.orderId
      );

      return webhookResponse(
        res,
        503,
        'Payment is not confirmed yet.'
      );

    }


    /* =================================
       9. HANDLE ALREADY PAID ORDER

       Browser verification and webhook
       may both confirm the same payment.
    ================================= */

    if (
      order.paymentStatus === 'SUCCESS'
    ) {

      return webhookResponse(
        res,
        200,
        'Payment already confirmed.'
      );

    }


    /* =================================
       10. CHECK ELIGIBILITY
    ================================= */

    if (
      order.orderStatus === 'Cancelled' ||
      order.stockReserved !== true ||
      order.paymentStatus !== 'PENDING'
    ) {

      console.error(
        'Cashfree manual review required:',
        order.orderId
      );

      return webhookResponse(
        res,
        409,
        'Paid order requires manual review.'
      );

    }


    /* =================================
       11. ATOMIC PAYMENT UPDATE

       Only PENDING payment can transition
       to SUCCESS.

       This query prevents duplicate
       updates from concurrent requests.
    ================================= */

    const update = {

      $set: {

        paymentStatus:
          'SUCCESS'

      },

      $push: {

        statusHistory: {

          status:
            order.orderStatus,

          note:
            'Cashfree payment confirmed by verified webhook.',

          changedAt:
            new Date()

        }

      }

    };

    if (
      payment.cf_payment_id != null
    ) {

      update.$set.cashfreePaymentId =
        String(payment.cf_payment_id);

    }

    const updatedOrder =
      await Order.findOneAndUpdate(

        {

          _id:
            order._id,

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

        update,

        {
          new: true
        }

      );


    /* =================================
       12. HANDLE CONCURRENT VERIFICATION

       If no update occurred, another
       request may have confirmed payment.
    ================================= */

    const confirmedOrder =
      updatedOrder ||
      await Order.findById(
        order._id
      );

    if (
      !confirmedOrder ||
      confirmedOrder.paymentStatus !== 'SUCCESS' ||
      confirmedOrder.orderStatus === 'Cancelled' ||
      confirmedOrder.stockReserved !== true
    ) {

      console.error(
        'Cashfree payment reconciliation needed:',
        order.orderId
      );

      return webhookResponse(
        res,
        409,
        'Payment requires manual review.'
      );

    }


    /* =================================
       13. CART PROTECTION

       Do not clear the entire cart
       inside a delayed webhook.

       The customer may have added new
       products while payment was pending.

       A separate cart reconciliation
       mechanism is required.
    ================================= */


    /* =================================
       14. ACKNOWLEDGE SUCCESS
    ================================= */

    return webhookResponse(
      res,
      200,
      'Cashfree payment confirmed.'
    );

  } catch (err) {

    console.error(
      'Cashfree webhook processing error:',
      err.message
    );

    return webhookResponse(
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
