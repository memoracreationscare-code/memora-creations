
'use strict';

/*
=========================================
 MEMORA CREATIONS
 SHIPROCKET DELIVERY SERVICE - VERSION 4

 - MongoDB verified product weight
 - Quantity-wise combined weight
 - COD and PREPAID serviceability
 - Shiprocket courier ETD support
 - Validates estimated delivery dates
 - No fake delivery dates
 - No changes to payments or orders
=========================================
*/

const mongoose = require('mongoose');
const Product = require('../models/Product');

const {
  configured,
  checkCourierServiceability
} = require('./shiprocketService');


/* =====================================
   VALIDATE PIN CODE
===================================== */

function normalizePincode(value) {
  if (
    typeof value !== 'string' &&
    typeof value !== 'number'
  ) {
    return null;
  }

  const pin = String(value).trim();

  return /^[1-9][0-9]{5}$/.test(pin)
    ? pin
    : null;
}


/* =====================================
   SHIPROCKET CONFIGURATION
===================================== */

function getDeliveryConfig() {
  return {
    shiprocketConfigured: configured(),

    pickupLocation: String(
      process.env.SHIPROCKET_PICKUP_LOCATION ||
      'Home'
    ).trim()
  };
}


/* =====================================
   TRUSTED PRODUCT PACKAGE WEIGHT
===================================== */

async function getTrustedPackage(items) {

  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    items.length > 100
  ) {
    return {
      success: false,
      reason: 'INVALID_ITEMS',
      message: 'Please select valid products.'
    };
  }

  const merged = new Map();

  for (const item of items) {

    if (
      !item ||
      typeof item !== 'object' ||
      Array.isArray(item)
    ) {
      return {
        success: false,
        reason: 'INVALID_ITEMS',
        message: 'Invalid product details.'
      };
    }

    const id = String(
      item.productId || item.product || ''
    );

    const quantity = Number(item.quantity);

    if (
      !mongoose.isValidObjectId(id) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 99
    ) {
      return {
        success: false,
        reason: 'INVALID_ITEMS',
        message: 'Invalid product or quantity.'
      };
    }

    const previous = merged.get(id) || 0;

    if (previous + quantity > 99) {
      return {
        success: false,
        reason: 'INVALID_ITEMS',
        message: 'Maximum quantity exceeded.'
      };
    }

    merged.set(id, previous + quantity);
  }

  const ids = [...merged.keys()];

  const products = await Product.find({
    _id: { $in: ids },
    isActive: true
  })
    .select(
      '_id name shippingWeightKg ' +
      'packageLengthCm packageWidthCm ' +
      'packageHeightCm'
    )
    .lean();

  if (products.length !== ids.length) {
    return {
      success: false,
      reason: 'PRODUCT_UNAVAILABLE',
      message:
        'One or more products are unavailable.'
    };
  }

  let totalWeight = 0;

  for (const product of products) {

    const quantity = merged.get(
      String(product._id)
    );

    const weight = Number(
      product.shippingWeightKg
    );

    const length = Number(
      product.packageLengthCm
    );

    const width = Number(
      product.packageWidthCm
    );

    const height = Number(
      product.packageHeightCm
    );

    if (
      !Number.isFinite(weight) ||
      weight < 0.001 ||
      weight > 100 ||
      !Number.isFinite(length) ||
      length < 0.1 ||
      !Number.isFinite(width) ||
      width < 0.1 ||
      !Number.isFinite(height) ||
      height < 0.1
    ) {
      return {
        success: false,
        reason: 'SHIPPING_DETAILS_MISSING',
        message:
          'Package weight or dimensions are ' +
          'missing for one or more products.'
      };
    }

    totalWeight += weight * quantity;
  }

  totalWeight = Math.ceil(
    totalWeight * 1000
  ) / 1000;

  if (
    !Number.isFinite(totalWeight) ||
    totalWeight <= 0 ||
    totalWeight > 100
  ) {
    return {
      success: false,
      reason: 'INVALID_PACKAGE_WEIGHT',
      message:
        'Package weight is outside supported limits.'
    };
  }

  return {
    success: true,
    weightKg: totalWeight,
    productCount: ids.length,
    totalQuantity:
      [...merged.values()].reduce(
        (sum, quantity) => sum + quantity,
        0
      )
  };
}


/* =====================================
   VERIFIED SHIPROCKET ETD PARSER

   Supported:
   - YYYY-MM-DD
   - MMM DD, YYYY
   - MMM DD YYYY

   No estimate is generated locally.
===================================== */

const MONTHS = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11
};

function utcDate(year, month, day) {

  const date = new Date(
    Date.UTC(year, month, day)
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function parseShiprocketDate(value) {

  if (typeof value !== 'string') {
    return null;
  }

  const text = value.trim();

  let match = text.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (match) {
    return utcDate(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    );
  }

  match = text.match(
    /^([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})$/
  );

  if (!match) {
    return null;
  }

  const month = MONTHS[
    match[1].toLowerCase()
  ];

  if (month === undefined) {
    return null;
  }

  return utcDate(
    Number(match[3]),
    month,
    Number(match[2])
  );
}


/* =====================================
   CURRENT INDIA CALENDAR DATE
===================================== */

function todayInIndia() {

  const parts = new Intl.DateTimeFormat(
    'en-GB',
    {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }
  ).formatToParts(new Date());

  const read = type => Number(
    parts.find(part => part.type === type)
      ?.value
  );

  return utcDate(
    read('year'),
    read('month') - 1,
    read('day')
  );
}


/* =====================================
   CHOOSE EARLIEST VALID COURIER ETD

   This is not the assigned courier.
   Actual delivery date may change.
===================================== */

function getCourierEstimate(couriers) {

  const today = todayInIndia();

  if (!today) {
    return null;
  }

  const maximumDate = new Date(
    today.getTime() +
    60 * 24 * 60 * 60 * 1000
  );

  const options = [];

  for (const courier of couriers) {

    const date = parseShiprocketDate(
      courier.etd
    );

    if (
      !date ||
      date < today ||
      date > maximumDate
    ) {
      continue;
    }

    const days = Number(
      courier.estimated_delivery_days
    );

    options.push({
      date,
      courierName:
        typeof courier.courier_name === 'string'
          ? courier.courier_name
              .trim()
              .slice(0, 100)
          : '',
      estimatedDays:
        Number.isInteger(days) &&
        days >= 0 &&
        days <= 60
          ? days
          : null
    });
  }

  if (!options.length) {
    return null;
  }

  options.sort(
    (a, b) =>
      a.date.getTime() -
      b.date.getTime()
  );

  const selected = options[0];

  return {
    date: selected.date
      .toISOString()
      .slice(0, 10),

    courierName: selected.courierName,

    estimatedDays: selected.estimatedDays
  };
}


/* =====================================
   COURIER AVAILABILITY
===================================== */

async function checkDeliveryPincode({
  pincode,
  paymentMethod = 'PREPAID',
  items
} = {}) {

  const pin = normalizePincode(pincode);

  if (!pin) {
    return {
      success: false,
      available: null,
      reason: 'INVALID_PINCODE',
      message:
        'Enter a valid 6-digit Indian PIN code.'
    };
  }

  const method = String(
    paymentMethod
  ).toUpperCase();

  if (
    !['COD', 'PREPAID'].includes(method)
  ) {
    return {
      success: false,
      available: null,
      reason: 'INVALID_PAYMENT_METHOD',
      message: 'Invalid payment method.'
    };
  }

  const config = getDeliveryConfig();

  if (!config.shiprocketConfigured) {
    return {
      success: false,
      available: null,
      reason:
        'DELIVERY_CHECK_NOT_CONFIGURED',
      message:
        'Shiprocket delivery checking is not configured.'
    };
  }

  try {

    const packageInfo =
      await getTrustedPackage(items);

    if (!packageInfo.success) {
      return {
        success: false,
        available: null,
        pincode: pin,
        reason: packageInfo.reason,
        message: packageInfo.message
      };
    }

    const result =
      await checkCourierServiceability({

        pickupLocation:
          config.pickupLocation,

        deliveryPincode: pin,

        weight: packageInfo.weightKg,

        cod: method === 'COD'

      });

    const couriers = Array.isArray(
      result.couriers
    )
      ? result.couriers
      : [];

    const matchingCouriers =
      couriers.filter(courier => {

        if (
          !courier ||
          typeof courier !== 'object'
        ) {
          return false;
        }

        if (method === 'COD') {
          return (
            courier.cod === true ||
            courier.cod === 'Y' ||
            Number(courier.cod) === 1
          );
        }

        return true;
      });

    const available =
      matchingCouriers.length > 0;

    const estimate = available
      ? getCourierEstimate(
          matchingCouriers
        )
      : null;

    return {

      success: true,

      pincode: pin,

      paymentMethod: method,

      available,

      courierCount:
        matchingCouriers.length,

      packageWeightKg:
        packageInfo.weightKg,

      productCount:
        packageInfo.productCount,

      totalQuantity:
        packageInfo.totalQuantity,

      estimatedDeliveryDate:
        estimate?.date || null,

      estimatedDeliveryDays:
        estimate?.estimatedDays ?? null,

      estimatedCourier:
        estimate?.courierName || null,

      estimateType:
        estimate
          ? 'EARLIEST_AVAILABLE_COURIER'
          : null,

      message: available
        ? 'Delivery service is available for this PIN code.'
        : 'No matching courier service is available for this PIN code.',

      note:
        'Delivery date, when available, is ' +
        'the earliest Shiprocket courier ' +
        'estimate, not a guaranteed date ' +
        'or a confirmed courier assignment.'

    };

  } catch (err) {

    console.error(
      '[Delivery Checker] Lookup failed:',
      err.message
    );

    return {

      success: false,

      available: null,

      pincode: pin,

      paymentMethod: method,

      reason:
        'DELIVERY_CHECK_TEMPORARILY_UNAVAILABLE',

      message:
        'Delivery availability could not be checked right now.'

    };
  }
}


/* =====================================
   EXPORTS
===================================== */

module.exports = {
  normalizePincode,
  getDeliveryConfig,
  getTrustedPackage,
  parseShiprocketDate,
  getCourierEstimate,
  checkDeliveryPincode
};
