const SHIPROCKET_BASE =
  'https://apiv2.shiprocket.in/v1/external';

let cachedToken = null;
let tokenExpiresAt = 0;


/* =========================
   CONFIG
========================= */

function configured() {
  return Boolean(
    process.env.SHIPROCKET_EMAIL &&
    process.env.SHIPROCKET_PASSWORD
  );
}


/* =========================
   AUTH TOKEN
========================= */

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
        email: process.env.SHIPROCKET_EMAIL,
        password: process.env.SHIPROCKET_PASSWORD
      })
    }
  );

  const data = await response.json();

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


/* =========================
   COMMON REQUEST
========================= */

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
   PICKUP LOCATIONS
========================= */

async function getPickupLocations() {

  return shiprocketRequest(
    '/settings/company/pickup'
  );
}


async function getPickupLocation(
  pickupLocation = 'Home'
) {

  const data =
    await getPickupLocations();

  const locations =
    data?.data?.shipping_address ||
    [];

  if (!locations.length) {

    throw new Error(
      'No Shiprocket pickup location found.'
    );
  }

  const requested =
    String(pickupLocation)
      .trim()
      .toLowerCase();

  let location =
    locations.find(item =>
      String(
        item.pickup_location || ''
      )
        .trim()
        .toLowerCase() === requested
    );

  if (!location) {

    location =
      locations.find(
        item =>
          Number(
            item.is_primary_location
          ) === 1
      );

  }

  if (!location) {
    location = locations[0];
  }

  if (!location.pin_code) {

    throw new Error(
      'Pickup location PIN code not found.'
    );
  }

  return location;
}


/* =========================
   COURIER SERVICEABILITY
========================= */

async function checkCourierServiceability({
  pickupLocation = 'Home',
  deliveryPincode,
  weight,
  length,
  width,
  height,
  cod = false,
  declaredValue = 0
}) {

  const pickup =
    await getPickupLocation(
      pickupLocation
    );

  const pickupPincode =
    String(
      pickup.pin_code || ''
    ).trim();

  const destination =
    String(
      deliveryPincode || ''
    ).trim();

  if (!/^\d{6}$/.test(destination)) {

    throw new Error(
      'Valid customer delivery PIN code is required.'
    );

  }

  const packageWeight =
    Number(weight);

  if (
    !Number.isFinite(packageWeight) ||
    packageWeight <= 0
  ) {

    throw new Error(
      'Valid package weight is required.'
    );

  }

  const params =
    new URLSearchParams();

  params.set(
    'pickup_postcode',
    pickupPincode
  );

  params.set(
    'delivery_postcode',
    destination
  );

  params.set(
    'weight',
    String(packageWeight)
  );

  params.set(
    'cod',
    cod ? '1' : '0'
  );

  if (Number(length) > 0) {

    params.set(
      'length',
      String(Number(length))
    );

  }

  if (Number(width) > 0) {

    params.set(
      'breadth',
      String(Number(width))
    );

  }

  if (Number(height) > 0) {

    params.set(
      'height',
      String(Number(height))
    );

  }

  if (Number(declaredValue) > 0) {

    params.set(
      'declared_value',
      String(
        Number(declaredValue)
      )
    );

  }

  const data =
    await shiprocketRequest(
      '/courier/serviceability/?' +
      params.toString()
    );

  return {
    pickupLocation:
      pickup.pickup_location,

    pickupPincode,

    deliveryPincode:
      destination,

    couriers:
      data?.data
        ?.available_courier_companies ||
      [],

    raw:
      data
  };
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
    new Date(
      order.createdAt ||
      Date.now()
    );

  const orderDate =
    date.getFullYear() +
    '-' +
    String(
      date.getMonth() + 1
    ).padStart(2, '0') +
    '-' +
    String(
      date.getDate()
    ).padStart(2, '0') +
    ' ' +
    String(
      date.getHours()
    ).padStart(2, '0') +
    ':' +
    String(
      date.getMinutes()
    ).padStart(2, '0');

  const orderItems =
    (order.items || [])
      .map(item => ({

        name:
          item.name,

        sku:
          item.productId,

        units:
          Number(
            item.quantity
          ),

        selling_price:
          Number(
            item.unitPrice
          ),

        discount: 0,
        tax: 0,
        hsn: ''

      }));

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
      String(
        address.pinCode || ''
      ),

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
      Number(
        order.discount || 0
      ),

    sub_total:
      Number(
        order.subtotal || 0
      ),

    length:
      Number(
        packageData.length
      ),

    breadth:
      Number(
        packageData.width
      ),

    height:
      Number(
        packageData.height
      ),

    weight:
      Number(
        packageData.weight
      )
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
   ASSIGN COURIER / AWB
========================= */

async function assignCourierAwb({
  shipmentId,
  courierCompanyId
}) {

  const shipment =
    Number(shipmentId);

  const courier =
    Number(courierCompanyId);


  if (
    !Number.isFinite(shipment) ||
    shipment <= 0
  ) {

    throw new Error(
      'Valid Shiprocket shipment ID is required.'
    );

  }


  if (
    !Number.isFinite(courier) ||
    courier <= 0
  ) {

    throw new Error(
      'Please select a valid courier.'
    );

  }


  const data =
    await shiprocketRequest(
      '/courier/assign/awb',
      {
        method: 'POST',

        body:
          JSON.stringify({
            shipment_id:
              shipment,

            courier_id:
              courier
          })
      }
    );


  const awbData =
    data?.response?.data ||
    data?.data ||
    data;


  return {
    ...data,

    awbCode:
      awbData?.awb_code ||
      awbData?.awb ||
      '',

    courierName:
      awbData?.courier_name ||
      '',

    shipmentId:
      awbData?.shipment_id ||
      shipment
  };
}


/* =========================
   WALLET
========================= */

async function getWalletBalance() {

  return shiprocketRequest(
    '/account/details/wallet-balance'
  );

}


/* =========================
   EXPORTS
========================= */

module.exports = {

  configured,

  getShiprocketToken,

  shiprocketRequest,

  getPickupLocations,

  getPickupLocation,

  checkCourierServiceability,

  createShiprocketOrder,

  assignCourierAwb,

  getWalletBalance

};
