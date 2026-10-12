
/*
=========================================
 MEMORA CREATIONS
 CASHFREE PAYMENT SERVICE

 SANDBOX + PRODUCTION

 ORDER CREATION
 30 MINUTE PAYMENT EXPIRY
 PAYMENT VERIFICATION
 PAYMENT ATTEMPTS
 SAFE ORDER RECONCILIATION
=========================================
*/

const CASHFREE_API_VERSION =
  '2023-08-01';

const PAYMENT_EXPIRY_MINUTES = 30;


/* =====================================
   ERROR HELPER
===================================== */

function cashfreeError(
  message,
  statusCode = 502
) {

  const err = new Error(message);

  err.statusCode = statusCode;

  return err;

}


/* =====================================
   CASHFREE CONFIGURATION
===================================== */

function getCashfreeConfig() {

  const clientId =
    process.env.CASHFREE_CLIENT_ID;

  const clientSecret =
    process.env.CASHFREE_CLIENT_SECRET;

  const env = String(
    process.env.CASHFREE_ENV || 'sandbox'
  ).toLowerCase();

  if (!clientId || !clientSecret) {

    throw cashfreeError(
      'Cashfree credentials are not configured.',
      503
    );

  }

  if (
    !['sandbox', 'production'].includes(env)
  ) {

    throw cashfreeError(
      'Invalid Cashfree environment.',
      503
    );

  }

  const baseUrl =
    env === 'production'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg';

  return {
    clientId,
    clientSecret,
    env,
    baseUrl
  };

}


/* =====================================
   CASHFREE API REQUEST
===================================== */

async function cashfreeRequest(
  endpoint,
  {
    method = 'GET',
    body
  } = {}
) {

  const config = getCashfreeConfig();

  let response;

  try {

    response = await fetch(

      config.baseUrl + endpoint,

      {
        method,

        headers: {

          'Content-Type':
            'application/json',

          'Accept':
            'application/json',

          'x-client-id':
            config.clientId,

          'x-client-secret':
            config.clientSecret,

          'x-api-version':
            CASHFREE_API_VERSION

        },

        ...(body !== undefined
          ? {
              body: JSON.stringify(body)
            }
          : {}),

        signal:
          AbortSignal.timeout(20000)

      }

    );

  } catch (err) {

    console.error(
      'Cashfree connection error:',
      err.message
    );

    throw cashfreeError(
      'Cashfree server connection failed.'
    );

  }

  let data;

  try {

    data = await response.json();

  } catch (_) {

    throw cashfreeError(
      'Invalid response from Cashfree.'
    );

  }

  if (!response.ok) {

    console.error(
      'Cashfree API error:',
      response.status,
      data?.code || 'UNKNOWN_ERROR'
    );

    throw cashfreeError(
      'Cashfree request failed.',
      502
    );

  }

  return data;

}


/* =====================================
   VALIDATE ORDER ID
===================================== */

function validateOrderId(orderId) {

  if (
    typeof orderId !== 'string' ||
    !orderId.trim()
  ) {

    throw cashfreeError(
      'Cashfree order ID is required.',
      400
    );

  }

  return encodeURIComponent(
    orderId.trim()
  );

}


/* =====================================
   CREATE CASHFREE ORDER

   NEW FEATURE:
   PAYMENT EXPIRY = 30 MINUTES

   Applies only to newly created orders.
===================================== */

async function createCashfreeOrder({

  orderId,
  amount,
  customerId,
  customerName,
  customerPhone,
  customerEmail,
  returnUrl

}) {

  const parsedAmount =
    Number(amount);

  if (
    !orderId ||
    !Number.isFinite(parsedAmount) ||
    parsedAmount <= 0 ||
    !customerId ||
    !/^[6-9]\d{9}$/.test(
      String(customerPhone || '')
    )
  ) {

    throw cashfreeError(
      'Invalid Cashfree order details.',
      400
    );

  }

  /* =================================
     30 MINUTE EXPIRY

     Cashfree accepts ISO 8601 time.
  ================================= */

  const orderExpiryTime =
    new Date(
      Date.now() +
      PAYMENT_EXPIRY_MINUTES * 60 * 1000
    ).toISOString();


  /* =================================
     CASHFREE ORDER PAYLOAD
  ================================= */

  const payload = {

    order_id:
      String(orderId),

    order_amount:
      Math.round(parsedAmount * 100) / 100,

    order_currency:
      'INR',

    order_expiry_time:
      orderExpiryTime,

    customer_details: {

      customer_id:
        String(customerId),

      customer_name:
        String(customerName || 'Customer'),

      customer_phone:
        String(customerPhone)

    }

  };

  if (customerEmail) {

    payload.customer_details.customer_email =
      String(customerEmail);

  }

  if (returnUrl) {

    payload.order_meta = {

      return_url:
        String(returnUrl)

    };

  }

  return cashfreeRequest(
    '/orders',
    {
      method: 'POST',
      body: payload
    }
  );

}


/* =====================================
   FETCH CASHFREE ORDER
===================================== */

async function fetchCashfreeOrder(orderId) {

  const id = validateOrderId(
    orderId
  );

  return cashfreeRequest(
    '/orders/' + id
  );

}


/* =====================================
   FETCH ALL PAYMENT ATTEMPTS

   Cashfree may return multiple
   payment attempts for one order.
===================================== */

async function fetchCashfreePayments(orderId) {

  const id = validateOrderId(
    orderId
  );

  const payments = await cashfreeRequest(
    '/orders/' + id + '/payments'
  );

  if (!Array.isArray(payments)) {

    throw cashfreeError(
      'Invalid Cashfree payments response.'
    );

  }

  return payments;

}


/* =====================================
   CHECK SUCCESSFUL ORDER
===================================== */

function isCashfreePaymentSuccessful(
  cashfreeOrder,
  expectedAmount
) {

  const actualAmount =
    Number(cashfreeOrder?.order_amount);

  const requiredAmount =
    Number(expectedAmount);

  return (

    cashfreeOrder?.order_status === 'PAID' &&

    cashfreeOrder?.order_currency === 'INR' &&

    Number.isFinite(actualAmount) &&

    Number.isFinite(requiredAmount) &&

    actualAmount >= 0 &&

    requiredAmount >= 0 &&

    Math.round(actualAmount * 100) ===
    Math.round(requiredAmount * 100)

  );

}


/* =====================================
   SUMMARIZE PAYMENT ATTEMPTS

   INFORMATIONAL ONLY

   Does not release stock.
===================================== */

function summarizeCashfreePayments(payments) {

  if (!Array.isArray(payments)) {

    throw cashfreeError(
      'Invalid payment attempts.',
      400
    );

  }

  const summary = {

    totalAttempts:
      payments.length,

    successful:
      0,

    pending:
      0,

    failed:
      0,

    other:
      0,

    hasSuccessfulPayment:
      false,

    hasPendingPayment:
      false

  };

  for (const payment of payments) {

    const status = String(
      payment?.payment_status || ''
    ).toUpperCase();

    if (status === 'SUCCESS') {

      summary.successful++;

    } else if (status === 'PENDING') {

      summary.pending++;

    } else if (
      status === 'FAILED' ||
      status === 'USER_DROPPED'
    ) {

      summary.failed++;

    } else {

      summary.other++;

    }

  }

  summary.hasSuccessfulPayment =
    summary.successful > 0;

  summary.hasPendingPayment =
    summary.pending > 0;

  return summary;

}


/* =====================================
   CHECK ORDER FINAL STATE

   INSPECTION ONLY

   Does not cancel orders.
   Does not release stock.
===================================== */

async function inspectCashfreeOrder(orderId) {

  const gatewayOrder =
    await fetchCashfreeOrder(orderId);

  const payments =
    await fetchCashfreePayments(orderId);

  const summary =
    summarizeCashfreePayments(payments);

  const orderStatus = String(
    gatewayOrder.order_status || 'UNKNOWN'
  ).toUpperCase();

  const terminal =
    orderStatus === 'EXPIRED' ||
    orderStatus === 'TERMINATED';

  return {

    gatewayOrder,

    payments,

    summary,

    orderStatus,

    terminal,

    requiresManualReview:
      orderStatus === 'PAID' ||
      summary.hasSuccessfulPayment ||
      summary.hasPendingPayment ||
      !terminal

  };

}


/* =====================================
   EXPORT FUNCTIONS
===================================== */

module.exports = {

  getCashfreeConfig,

  createCashfreeOrder,

  fetchCashfreeOrder,

  fetchCashfreePayments,

  isCashfreePaymentSuccessful,

  summarizeCashfreePayments,

  inspectCashfreeOrder

};
