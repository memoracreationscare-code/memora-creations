const SHIPROCKET_BASE =
  'https://apiv2.shiprocket.in/v1/external';

let cachedToken = null;
let tokenExpiresAt = 0;


function configured() {
  return Boolean(
    process.env.SHIPROCKET_EMAIL &&
    process.env.SHIPROCKET_PASSWORD
  );
}


async function getShiprocketToken() {

  if (!configured()) {
    throw new Error(
      'Shiprocket credentials are not configured.'
    );
  }

  if (
    cachedToken &&
    Date.now() < tokenExpiresAt
  ) {
    return cachedToken;
  }

  const response = await fetch(
    `${SHIPROCKET_BASE}/auth/login`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        email:
          process.env.SHIPROCKET_EMAIL,

        password:
          process.env.SHIPROCKET_PASSWORD
      })
    }
  );

  const data =
    await response.json();

  if (!response.ok || !data.token) {

    console.error(
      'Shiprocket auth error:',
      data
    );

    throw new Error(
      data?.message ||
      'Shiprocket authentication failed.'
    );
  }

  cachedToken = data.token;

  tokenExpiresAt =
    Date.now() +
    (8 * 60 * 60 * 1000);

  return cachedToken;
}


async function shiprocketRequest(
  path,
  options = {}
) {

  const token =
    await getShiprocketToken();

  const response = await fetch(
    `${SHIPROCKET_BASE}${path}`,
    {
      ...options,

      headers: {
        'Content-Type':
          'application/json',

        Authorization:
          `Bearer ${token}`,

        ...(options.headers || {})
      }
    }
  );

  let data = {};

  try {
    data = await response.json();
  } catch {}

  if (!response.ok) {

    console.error(
      'Shiprocket API error:',
      response.status,
      data
    );

    throw new Error(
      data?.message ||
      'Shiprocket API request failed.'
    );
  }

  return data;
}


/* =========================
   CREATE SHIPROCKET ORDER
========================= */

async function createShiprocketOrder(
  order,
  packageData
) {

  const address =
    order.shippingAddress || {};

  const customer =
    order.customer || {};

  const date =
    new Date(order.createdAt || Date.now());

  const orderDate =
    date.getFullYear() +
    '-' +
    String(date.getMonth() + 1)
      .padStart(2, '0') +
    '-' +
    String(date.getDate())
      .padStart(2, '0') +
    ' ' +
    String(date.getHours())
      .padStart(2, '0') +
    ':' +
    String(date.getMinutes())
      .padStart(2, '0');


  const orderItems =
    (order.items || []).map(
      item => ({
        name:
          item.name,

        sku:
          item.productId,

        units:
          Number(item.quantity),

        selling_price:
          Number(item.unitPrice),

        discount: 0,

        tax: 0,

        hsn: ''
      })
    );


  const payload = {

    order_id:
      order.orderId,

    order_date:
      orderDate,

    pickup_location:
      packageData.pickupLocation ||
      'Home',

    comment:
      'Order from MEMORA CREATIONS',


    billing_customer_name:
      address.fullName ||
      customer.fullName ||
      'Customer',

    billing_last_name:
      '',

    billing_address:
      address.addressLine,

    billing_address_2:
      '',

    billing_city:
      address.city || '',

    billing_pincode:
      String(address.pinCode || ''),

    billing_state:
      address.state || '',

    billing_country:
      'India',

    billing_email:
      customer.email || '',

    billing_phone:
      address.mobile ||
      customer.mobile,


    shipping_is_billing:
      true,


    order_items:
      orderItems,


    payment_method:
      order.paymentMethod === 'COD'
        ? 'COD'
        : 'Prepaid',


    shipping_charges:
      Number(
        order.deliveryCharge || 0
      ),

    giftwrap_charges: 0,

    transaction_charges: 0,

    total_discount:
      Number(order.discount || 0),

    sub_total:
      Number(order.subtotal || 0),


    length:
      Number(packageData.length),

    breadth:
      Number(packageData.width),

    height:
      Number(packageData.height),

    weight:
      Number(packageData.weight)
  };


  return shiprocketRequest(
    '/orders/create/adhoc',
    {
      method: 'POST',
      body:
        JSON.stringify(payload)
    }
  );
}


/* =========================
   WALLET
========================= */

async function getWalletBalance() {

  return shiprocketRequest(
    '/account/details/wallet-balance'
  );
}


module.exports = {

  configured,

  getShiprocketToken,

  shiprocketRequest,

  createShiprocketOrder,

  getWalletBalance
};
