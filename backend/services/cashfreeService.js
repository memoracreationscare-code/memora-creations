
/* =========================================
   MEMORA CREATIONS
   CASHFREE PAYMENT SERVICE
   Sandbox / Production Support
========================================= */

const CASHFREE_API_VERSION = '2023-08-01';

function getCashfreeConfig() {

  const clientId =
    process.env.CASHFREE_CLIENT_ID;

  const clientSecret =
    process.env.CASHFREE_CLIENT_SECRET;

  const env = (
    process.env.CASHFREE_ENV || 'sandbox'
  ).toLowerCase();

  if (!clientId || !clientSecret) {
    const error = new Error(
      'Cashfree credentials are not configured.'
    );

    error.statusCode = 503;
    throw error;
  }

  if (!['sandbox', 'production'].includes(env)) {
    const error = new Error(
      'Invalid Cashfree environment.'
    );

    error.statusCode = 503;
    throw error;
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


/* =========================================
   CASHFREE API REQUEST
========================================= */

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
          'Content-Type': 'application/json',

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

        signal: AbortSignal.timeout(20000)
      }
    );

  } catch (_) {

    const error = new Error(
      'Cashfree server connection failed.'
    );

    error.statusCode = 502;
    throw error;

  }

  const data = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {

    console.error(
      'Cashfree API failed:',
      response.status,
      data.code || 'UNKNOWN_ERROR'
    );

    const error = new Error(
      'Cashfree payment request failed. Please try again.'
    );

    error.statusCode = 502;
    throw error;
  }

  return data;
}


/* =========================================
   CREATE CASHFREE PAYMENT ORDER
========================================= */

async function createCashfreeOrder({
  orderId,
  amount,
  customerId,
  customerName,
  customerPhone,
  customerEmail,
  returnUrl
}) {

  const parsedAmount = Number(amount);

  if (
    !orderId ||
    !Number.isFinite(parsedAmount) ||
    parsedAmount <= 0 ||
    !customerId ||
    !/^[6-9]\d{9}$/.test(
      String(customerPhone || '')
    )
  ) {
    const error = new Error(
      'Invalid Cashfree order details.'
    );

    error.statusCode = 400;
    throw error;
  }

  const payload = {
    order_id: String(orderId),

    order_amount:
      Math.round(parsedAmount * 100) / 100,

    order_currency: 'INR',

    customer_details: {
      customer_id: String(customerId),

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
      return_url: String(returnUrl)
    };
  }

  return cashfreeRequest('/orders', {
    method: 'POST',
    body: payload
  });
}


/* =========================================
   VERIFY CASHFREE PAYMENT ORDER
========================================= */

async function fetchCashfreeOrder(orderId) {

  if (!orderId) {
    const error = new Error(
      'Cashfree order ID is required.'
    );

    error.statusCode = 400;
    throw error;
  }

  return cashfreeRequest(
    '/orders/' +
    encodeURIComponent(String(orderId))
  );
}


/* =========================================
   CHECK VERIFIED PAYMENT STATUS
========================================= */

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

    Math.round(actualAmount * 100) ===
      Math.round(requiredAmount * 100)
  );
}


/* =========================================
   EXPORT FUNCTIONS
========================================= */

module.exports = {
  getCashfreeConfig,
  createCashfreeOrder,
  fetchCashfreeOrder,
  isCashfreePaymentSuccessful
};
