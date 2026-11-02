
'use strict';

/*
=========================================
 MEMORA CREATIONS
 WHATSAPP NOTIFICATION DISPATCH SERVICE

 - Explicit customer consent required
 - One notification per order/event
 - Atomic duplicate protection
 - No order/payment/stock modifications
 - Uncertain sends are not auto-retried
=========================================
*/

const {
  WhatsAppNotification
} = require('../models');

const {
  sendOrderWhatsApp,
  getWhatsAppConfig
} = require('./whatsappService');

const {
  hasWhatsAppConsent
} = require('./whatsappConsentService');


const EVENT_STATUS = Object.freeze({
  ORDER_PLACED: 'Order Placed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered'
});


/*
=========================================
 CHECK NOTIFICATION ELIGIBILITY
=========================================
*/

function checkEligibility(order, event) {

  if (!order || !order._id || !order.orderId) {
    return 'INVALID_ORDER';
  }

  if (!Object.prototype.hasOwnProperty.call(
    EVENT_STATUS,
    event
  )) {
    return 'INVALID_EVENT';
  }

  if (order.orderStatus === 'Cancelled') {
    return 'ORDER_CANCELLED';
  }

  if (order.orderStatus !== EVENT_STATUS[event]) {
    return 'ORDER_STATUS_MISMATCH';
  }

  if (!hasWhatsAppConsent(order)) {
    return 'CUSTOMER_NOT_OPTED_IN';
  }

  /*
    Online orders should not receive
    placement messages before payment
    has actually succeeded.

    COD is permitted while COD_PENDING.
  */

  if (event === 'ORDER_PLACED') {

    const paymentAllowed =
      (
        order.paymentMethod === 'COD' &&
        order.paymentStatus === 'COD_PENDING'
      ) ||
      (
        ['CASHFREE', 'RAZORPAY']
          .includes(order.paymentMethod) &&
        order.paymentStatus === 'SUCCESS'
      );

    if (!paymentAllowed) {
      return 'PAYMENT_NOT_CONFIRMED';
    }
  }

  return null;
}


/*
=========================================
 DISPATCH ONE NOTIFICATION

 The unique MongoDB index on:
 (order, event)

 prevents concurrent calls from
 creating duplicate notification
 records.

 Once claimed, a message is never
 automatically retried, because
 the API result could be uncertain.
=========================================
*/

async function dispatchOrderWhatsApp(order, event) {

  const config = getWhatsAppConfig();

  if (!config.enabled) {
    return {
      sent: false,
      reason: 'WHATSAPP_DISABLED'
    };
  }

  const ineligibleReason =
    checkEligibility(order, event);

  if (ineligibleReason) {
    return {
      sent: false,
      reason: ineligibleReason
    };
  }

  let notification;

  /*
    Claim the notification event
    before contacting Meta.
  */

  try {

    notification = await WhatsAppNotification.create({
      order: order._id,
      event,
      customerOptedIn: true,
      status: 'SENDING',
      attemptCount: 1,
      lastAttemptAt: new Date()
    });

  } catch (err) {

    if (err && err.code === 11000) {
      return {
        sent: false,
        reason: 'ALREADY_PROCESSED'
      };
    }

    throw err;
  }

  /*
    Network call is outside any
    order/payment MongoDB transaction.
  */

  let result;

  try {

    result = await sendOrderWhatsApp({
      event,
      order,
      optedIn: true
    });

  } catch (err) {

    console.error(
      '[WhatsApp] Unexpected dispatch error:',
      event,
      err.message
    );

    result = {
      sent: false,
      reason: 'WHATSAPP_API_ERROR'
    };
  }

  const accepted =
    result?.accepted === true &&
    Boolean(result.messageId);

  /*
    A timeout or API error may mean
    Meta received the message.

    Therefore mark as UNKNOWN,
    not safely retryable FAILED.
  */

  const uncertain =
    result?.reason === 'WHATSAPP_API_ERROR';

  const nextStatus = accepted
    ? 'ACCEPTED'
    : uncertain
      ? 'UNKNOWN'
      : 'FAILED';

  try {

    await WhatsAppNotification.updateOne(
      {
        _id: notification._id,
        status: 'SENDING'
      },
      {
        $set: {
          status: nextStatus,
          acceptedAt: accepted
            ? new Date()
            : null,
          providerMessageId: accepted
            ? result.messageId
            : null,
          lastErrorCode: accepted
            ? null
            : String(
                result?.reason || 'UNKNOWN_ERROR'
              ).slice(0, 100)
        }
      }
    );

  } catch (err) {

    console.error(
      '[WhatsApp] Notification tracking update failed:',
      event,
      err.message
    );

    /*
      Do not retry automatically.
      The notification may already
      have been accepted by Meta.
    */

    return {
      sent: accepted,
      reason: 'TRACKING_UPDATE_FAILED',
      notificationId: String(notification._id)
    };
  }

  return {
    sent: accepted,
    reason: accepted
      ? 'ACCEPTED_BY_META'
      : result?.reason || 'SEND_FAILED',
    notificationId: String(notification._id),
    messageId: accepted
      ? result.messageId
      : null
  };
}


/*
=========================================
 EXPORTS
=========================================
*/

module.exports = {
  checkEligibility,
  dispatchOrderWhatsApp
};
