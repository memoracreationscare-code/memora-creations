
'use strict';

/*
=========================================
 MEMORA CREATIONS
 SHIPROCKET DELIVERY PINCODE SERVICE

 Dynamic Product Weight
 MongoDB Product Verification
 COD / PREPAID Availability
 No Payment or Order Modification
 No Fake Delivery Dates
=========================================
*/

const mongoose = require('mongoose');

const Product = require('../models/Product');

const {
  configured,
  checkCourierServiceability
} = require('./shiprocketService');


/* =====================================
   PINCODE VALIDATION
===================================== */

function normalizePincode(value) {

  if (
    typeof value !== 'string' &&
    typeof value !== 'number'
  ) {
    return null;
  }

  const pin = String(value).trim();

  if (!/^[1-9][0-9]{5}$/.test(pin)) {
    return null;
  }

  return pin;
}


/* =====================================
   DELIVERY CONFIGURATION
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
   READ TRUSTED PRODUCT WEIGHT

   Product IDs and quantities can be
   supplied by the customer.

   Shipping weight is ALWAYS read
   from MongoDB, never from the client.
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
    _id: {
      $in: ids
    },
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
  let missingShippingDetails = false;

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
      missingShippingDetails = true;
      break;
    }

    totalWeight += weight * quantity;
  }

  if (missingShippingDetails) {
    return {
      success: false,
      reason: 'SHIPPING_DETAILS_MISSING',
      message:
        'Package weight or dimensions ' +
        'are missing for one or more products.'
    };
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
    totalQuantity: [...merged.values()]
      .reduce((sum, quantity) => sum + quantity, 0)
  };
}


/* =====================================
   COURIER AVAILABILITY CHECK
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

  if (!['COD', 'PREPAID'].includes(method)) {
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
      reason: 'DELIVERY_CHECK_NOT_CONFIGURED',
      message:
        'Shiprocket delivery checking is not configured.'
    };
  }

  try {

    const packageInfo = await getTrustedPackage(
      items
    );

    if (!packageInfo.success) {
      return {
        success: false,
        available: null,
        pincode: pin,
        reason: packageInfo.reason,
        message: packageInfo.message
      };
    }

    const result = await checkCourierServiceability({

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

    const matchingCouriers = couriers.filter(
      courier => {

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
      }
    );

    const available =
      matchingCouriers.length > 0;

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

      estimatedDeliveryDate: null,

      message: available
        ? 'Delivery service is available for this PIN code.'
        : 'No matching courier service is available for this PIN code.',

      note:
        'This is an availability estimate, ' +
        'not a delivery promise. Actual packed ' +
        'parcel dimensions and final courier ' +
        'serviceability must be verified.'

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

  checkDeliveryPincode

};
