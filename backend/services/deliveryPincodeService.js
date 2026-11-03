
'use strict';

/*
=========================================
 MEMORA CREATIONS
 DELIVERY PIN CODE CHECKER

 Uses existing Shiprocket integration.

 - Validates Indian PIN codes
 - Checks actual courier availability
 - Supports prepaid and COD modes
 - Does not change payment or orders
 - Never invents delivery dates
=========================================
*/

const {
  configured,
  checkCourierServiceability
} = require('./shiprocketService');


/*
=========================================
 VALIDATE PIN CODE
=========================================
*/

function normalizePincode(value) {

  if (typeof value !== 'string' &&
      typeof value !== 'number') {
    return null;
  }

  const pincode = String(value).trim();

  if (!/^[1-9][0-9]{5}$/.test(pincode)) {
    return null;
  }

  return pincode;
}


/*
=========================================
 SHIPPING CONFIGURATION

 The weight must be configured by the
 store owner based on a realistic
 packed parcel weight.

 No guessed parcel weight is used.
=========================================
*/

function getDeliveryConfig() {

  const weight = Number(
    process.env.DELIVERY_CHECK_WEIGHT_KG
  );

  const pickupLocation = String(
    process.env.SHIPROCKET_PICKUP_LOCATION ||
    'Home'
  ).trim();

  return {

    shiprocketConfigured: configured(),

    pickupLocation,

    weightKg:
      Number.isFinite(weight) &&
      weight > 0 &&
      weight <= 100
        ? weight
        : null

  };

}


/*
=========================================
 CHECK COURIER AVAILABILITY

 available:
   true  = Courier found
   false = No matching courier found
   null  = Could not verify

 This is informational only.
 Final checkout and shipment require
 their own authoritative checks.
=========================================
*/

async function checkDeliveryPincode({
  pincode,
  paymentMethod = 'PREPAID'
} = {}) {

  const normalized =
    normalizePincode(pincode);

  if (!normalized) {
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
      message:
        'Invalid payment method.'
    };
  }

  const config = getDeliveryConfig();

  if (
    !config.shiprocketConfigured ||
    !config.weightKg
  ) {
    return {
      success: false,
      available: null,
      pincode: normalized,
      reason: 'DELIVERY_CHECK_NOT_CONFIGURED',
      message:
        'Delivery availability checking is not configured yet.'
    };
  }

  try {

    const result =
      await checkCourierServiceability({

        pickupLocation:
          config.pickupLocation,

        deliveryPincode:
          normalized,

        weight:
          config.weightKg,

        cod:
          method === 'COD'

      });

    const couriers =
      Array.isArray(result.couriers)
        ? result.couriers
        : [];

    /*
      Courier API responses may contain
      options that do not support COD.

      Keep only matching courier modes.
    */

    const matchingCouriers =
      couriers.filter(courier => {

        if (!courier ||
            typeof courier !== 'object') {
          return false;
        }

        if (method === 'COD') {
          return (
            Number(courier.cod) === 1 ||
            courier.cod === true ||
            courier.cod === 'Y'
          );
        }

        return true;

      });

    /*
      Shiprocket may return delivery
      estimates in differing formats.

      Do not turn an unverified
      value into a promised date.
    */

    const available =
      matchingCouriers.length > 0;

    return {

      success: true,

      pincode: normalized,

      paymentMethod: method,

      available,

      courierCount:
        matchingCouriers.length,

      estimatedDeliveryDate: null,

      message: available
        ? 'Delivery service is available for this PIN code.'
        : 'No matching courier service is currently available for this PIN code.',

      note:
        'Availability may change with parcel weight, dimensions, courier capacity and final shipment details.'

    };

  } catch (err) {

    /*
      Do not expose provider credentials
      or internal error response bodies.
    */

    console.error(
      '[Delivery Checker] Shiprocket lookup failed:',
      err.message
    );

    return {

      success: false,

      available: null,

      pincode: normalized,

      paymentMethod: method,

      reason:
        'DELIVERY_CHECK_TEMPORARILY_UNAVAILABLE',

      message:
        'Delivery availability could not be checked right now. Please try again.'

    };

  }

}


/*
=========================================
 EXPORTS
=========================================
*/

module.exports = {

  normalizePincode,

  getDeliveryConfig,

  checkDeliveryPincode

};
