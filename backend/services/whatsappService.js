
'use strict';

/*
==========================================
 MEMORA CREATIONS
 WHATSAPP ORDER NOTIFICATION SERVICE

 META WHATSAPP CLOUD API

 EVENTS:
 - ORDER_PLACED
 - SHIPPED
 - DELIVERED

 IMPORTANT:
 - Disabled by default
 - Customer opt-in required
 - Approved templates required
 - Secrets stay on backend
 - No payment/order status mutation
==========================================
*/

const https = require('https');

const EVENT_CONFIG = Object.freeze({

  ORDER_PLACED: {
    templateEnv:
      'WHATSAPP_TEMPLATE_ORDER_PLACED'
  },

  SHIPPED: {
    templateEnv:
      'WHATSAPP_TEMPLATE_SHIPPED'
  },

  DELIVERED: {
    templateEnv:
      'WHATSAPP_TEMPLATE_DELIVERED'
  }

});


/*
==========================================
 SAFE CONFIGURATION
==========================================
*/

function getWhatsAppConfig() {

  return {

    enabled:
      process.env.WHATSAPP_SEND_ENABLED === 'true',

    apiVersion:
      process.env.WHATSAPP_API_VERSION ||
      'v26.0',

    accessToken:
      process.env.WHATSAPP_ACCESS_TOKEN || '',

    phoneNumberId:
      process.env.WHATSAPP_PHONE_NUMBER_ID || '',

    language:
      process.env.WHATSAPP_TEMPLATE_LANGUAGE ||
      'en_US'

  };

}


/*
==========================================
 NORMALIZE INDIAN MOBILE NUMBER

 9876543210 -> 919876543210
 +919876543210 -> 919876543210
==========================================
*/

function normalizeWhatsAppNumber(value) {

  const digits = String(value || '')
    .replace(/\D/g, '');

  if (/^[6-9]\d{9}$/.test(digits)) {
    return '91' + digits;
  }

  if (/^91[6-9]\d{9}$/.test(digits)) {
    return digits;
  }

  return null;

}


/*
==========================================
 VALIDATE TEMPLATE NAME
==========================================
*/

function isValidTemplateName(value) {

  return /^[a-z0-9_]{1,512}$/.test(
    String(value || '')
  );

}


/*
==========================================
 POST JSON TO META API

 NO THIRD-PARTY NPM PACKAGE REQUIRED
==========================================
*/

function postJson(url, token, payload) {

  return new Promise((resolve, reject) => {

    const body = JSON.stringify(payload);

    const request = https.request(
      url,
      {
        method: 'POST',

        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
          'Content-Length':
            Buffer.byteLength(body)
        },

        timeout: 15000
      },
      response => {

        let raw = '';

        response.setEncoding('utf8');

        response.on('data', chunk => {

          raw += chunk;

          if (raw.length > 200000) {
            request.destroy(
              new Error('WhatsApp response too large.')
            );
          }

        });

        response.on('end', () => {

          let data = {};

          try {
            data = JSON.parse(raw);
          } catch {
            data = {};
          }

          const success =
            response.statusCode >= 200 &&
            response.statusCode < 300;

          if (!success) {

            const err = new Error(
              data.error?.message ||
              'WhatsApp API request failed.'
            );

            err.statusCode =
              response.statusCode;

            return reject(err);
          }

          resolve(data);
        });

      }
    );

    request.on('timeout', () => {

      request.destroy(
        new Error('WhatsApp request timed out.')
      );

    });

    request.on('error', reject);

    request.end(body);

  });

}


/*
==========================================
 SEND ORDER STATUS TEMPLATE

 APPROVED TEMPLATE BODY FORMAT:

 Hello {{1}},
 Your Memora Creations order {{2}}
 has been updated.

 Actual wording must match the
 approved template for each event.

 PARAMETER 1: Customer name
 PARAMETER 2: Order ID
==========================================
*/

async function sendOrderWhatsApp({
  event,
  order,
  optedIn = false
}) {

  const config = getWhatsAppConfig();

  /*
    Do not send until the owner
    explicitly enables sending.
  */

  if (!config.enabled) {

    return {
      sent: false,
      reason: 'WHATSAPP_DISABLED'
    };

  }

  /*
    Explicit, recorded customer
    permission is mandatory.
  */

  if (optedIn !== true) {

    return {
      sent: false,
      reason: 'CUSTOMER_NOT_OPTED_IN'
    };

  }

  const settings = EVENT_CONFIG[event];

  if (!settings) {

    return {
      sent: false,
      reason: 'INVALID_EVENT'
    };

  }

  if (!order || !order.orderId) {

    return {
      sent: false,
      reason: 'INVALID_ORDER'
    };

  }

  /*
    Do not send any update for
    cancelled orders.
  */

  if (order.orderStatus === 'Cancelled') {

    return {
      sent: false,
      reason: 'ORDER_CANCELLED'
    };

  }

  /*
    Verify order state.
  */

  const expectedStatus = {

    ORDER_PLACED: 'Order Placed',

    SHIPPED: 'Shipped',

    DELIVERED: 'Delivered'

  }[event];

  if (order.orderStatus !== expectedStatus) {

    return {
      sent: false,
      reason: 'ORDER_STATUS_MISMATCH'
    };

  }

  const templateName =
    process.env[settings.templateEnv];

  if (!isValidTemplateName(templateName)) {

    return {
      sent: false,
      reason: 'TEMPLATE_NOT_CONFIGURED'
    };

  }

  if (
    !config.accessToken ||
    !/^\d+$/.test(config.phoneNumberId) ||
    !/^v\d+\.\d+$/.test(config.apiVersion)
  ) {

    return {
      sent: false,
      reason: 'WHATSAPP_NOT_CONFIGURED'
    };

  }

  /*
    The customer mobile is taken
    from the trusted order record.
  */

  const recipient = normalizeWhatsAppNumber(
    order.customer?.mobile ||
    order.shippingAddress?.mobile
  );

  if (!recipient) {

    return {
      sent: false,
      reason: 'INVALID_CUSTOMER_MOBILE'
    };

  }

  const customerName = String(
    order.customer?.fullName ||
    order.shippingAddress?.fullName ||
    'Customer'
  ).trim().slice(0, 100);

  const orderId = String(
    order.orderId
  ).slice(0, 100);

  const url = new URL(
    'https://graph.facebook.com/' +
    config.apiVersion + '/' +
    config.phoneNumberId + '/messages'
  );

  const payload = {

    messaging_product: 'whatsapp',

    recipient_type: 'individual',

    to: recipient,

    type: 'template',

    template: {

      name: templateName,

      language: {
        code: config.language
      },

      components: [

        {
          type: 'body',

          parameters: [

            {
              type: 'text',
              text: customerName
            },

            {
              type: 'text',
              text: orderId
            }

          ]
        }

      ]

    }

  };

  /*
    Meta API call.

    This service does not modify
    order, payment or stock.
  */

  try {

    const response = await postJson(
      url,
      config.accessToken,
      payload
    );

    const messageId =
      response.messages?.[0]?.id || null;

    return {

      sent: Boolean(messageId),

      accepted: Boolean(messageId),

      event,

      messageId,

      /*
        Accepted by Meta does not
        mean delivered to customer.
      */

      reason: messageId
        ? 'ACCEPTED_BY_META'
        : 'NO_MESSAGE_ID'

    };

  } catch (err) {

    /*
      Never log the access token,
      customer mobile, or full payload.
    */

    console.error(
      '[WhatsApp] Order notification failed:',
      event,
      err.statusCode || '',
      err.message
    );

    return {

      sent: false,

      event,

      reason: 'WHATSAPP_API_ERROR',

      statusCode:
        err.statusCode || null

    };

  }

}


/*
==========================================
 EXPORTS
==========================================
*/

module.exports = {

  getWhatsAppConfig,

  normalizeWhatsAppNumber,

  sendOrderWhatsApp

};
