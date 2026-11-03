
'use strict';

/*
=========================================
 MEMORA CREATIONS
 GIFT WRAPPING SERVICE

 STANDARD = INR 29
 PREMIUM  = INR 59

 SANDBOX TESTING ONLY

 Features:
 - Server-controlled prices
 - Gift message validation
 - Production protection
 - Backwards-compatible defaults
 - No client-supplied fees accepted
=========================================
*/


/* =====================================
   SANDBOX-ONLY FEATURE SWITCH

   Both conditions must be true:

   CASHFREE_ENV=sandbox
   GIFT_WRAPPING_TEST_ENABLED=true

   Production payment environment
   always disables this feature.
===================================== */

const cashfreeEnvironment = String(
  process.env.CASHFREE_ENV || ''
).trim().toLowerCase();

const testFlag = String(
  process.env.GIFT_WRAPPING_TEST_ENABLED || ''
).trim().toLowerCase();

const GIFT_WRAPPING_ENABLED =
  cashfreeEnvironment === 'sandbox' &&
  testFlag === 'true';


/* =====================================
   CONFIGURATION
===================================== */

const MAX_GIFT_MESSAGE_LENGTH = 180;

const GIFT_WRAPPING_PRICES =
  Object.freeze({
    NONE: 0,
    STANDARD: 29,
    PREMIUM: 59
  });


/* =====================================
   DEFAULT PACKAGING
===================================== */

function defaultGiftWrapping() {
  return {
    selected: false,
    type: 'NONE',
    fee: 0,
    message: ''
  };
}


/* =====================================
   NORMALIZE MESSAGE
===================================== */

function normalizeGiftMessage(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return '';
  }

  if (typeof value !== 'string') {
    throw new Error(
      'Gift message must be text.'
    );
  }

  const message = value.trim();

  if (
    message.length >
    MAX_GIFT_MESSAGE_LENGTH
  ) {
    throw new Error(
      'Gift message cannot exceed ' +
      MAX_GIFT_MESSAGE_LENGTH +
      ' characters.'
    );
  }

  return message;
}


/* =====================================
   NORMALIZE TYPE
===================================== */

function normalizeGiftType(value) {
  const type = String(
    value || 'NONE'
  ).trim().toUpperCase();

  if (
    !Object.prototype.hasOwnProperty.call(
      GIFT_WRAPPING_PRICES,
      type
    )
  ) {
    throw new Error(
      'Invalid gift wrapping option.'
    );
  }

  return type;
}


/* =====================================
   SERVER-SIDE FEE

   Never trust fees from the browser.
===================================== */

function calculateGiftWrappingFee(type) {
  const normalizedType =
    normalizeGiftType(type);

  if (!GIFT_WRAPPING_ENABLED) {
    if (normalizedType !== 'NONE') {
      throw new Error(
        'Gift wrapping is not available yet.'
      );
    }

    return 0;
  }

  const fee =
    GIFT_WRAPPING_PRICES[
      normalizedType
    ];

  if (
    !Number.isFinite(fee) ||
    fee < 0
  ) {
    throw new Error(
      'Invalid gift wrapping price configuration.'
    );
  }

  return Math.round(fee * 100) / 100;
}


/* =====================================
   VALIDATE CUSTOMER SELECTION

   Existing customers:
   Missing input => normal packaging.

   Invalid or unavailable wrapping:
   Reject instead of silently charging.
===================================== */

function prepareGiftWrapping(input = null) {
  if (
    input === null ||
    input === undefined
  ) {
    return defaultGiftWrapping();
  }

  if (
    typeof input !== 'object' ||
    Array.isArray(input)
  ) {
    throw new Error(
      'Invalid gift wrapping details.'
    );
  }

  if (
    input.selected !== undefined &&
    typeof input.selected !== 'boolean'
  ) {
    throw new Error(
      'Invalid gift wrapping selection.'
    );
  }

  const selected =
    input.selected === true;

  const type =
    normalizeGiftType(
      input.type || 'NONE'
    );

  const message =
    normalizeGiftMessage(
      input.message
    );


  /* FEATURE DISABLED */

  if (!GIFT_WRAPPING_ENABLED) {
    if (
      selected ||
      type !== 'NONE' ||
      message
    ) {
      throw new Error(
        'Gift wrapping is not available yet.'
      );
    }

    return defaultGiftWrapping();
  }


  /* NORMAL PACKAGING */

  if (!selected) {
    if (
      type !== 'NONE' ||
      message
    ) {
      throw new Error(
        'Gift wrapping selection is inconsistent.'
      );
    }

    return defaultGiftWrapping();
  }


  /* REQUIRE VALID PAID OPTION */

  if (type === 'NONE') {
    throw new Error(
      'Please select a gift wrapping option.'
    );
  }


  /* TRUSTED FEE */

  const fee =
    calculateGiftWrappingFee(type);

  return {
    selected: true,
    type,
    fee,
    message
  };
}


/* =====================================
   TRUSTED TOTAL CALCULATION
===================================== */

function addGiftWrappingToTotal(
  baseTotal,
  giftWrapping = null
) {
  const baseAmount =
    Number(baseTotal);

  if (
    !Number.isFinite(baseAmount) ||
    baseAmount < 0
  ) {
    throw new Error(
      'Invalid order total.'
    );
  }

  const gift =
    prepareGiftWrapping(
      giftWrapping
    );

  const grandTotal =
    Math.round(
      (baseAmount + gift.fee) * 100
    ) / 100;

  return {
    giftWrapping: gift,
    giftWrappingFee: gift.fee,
    grandTotal
  };
}


/* =====================================
   EXPORTS
===================================== */

module.exports = {
  GIFT_WRAPPING_ENABLED,
  GIFT_WRAPPING_PRICES,
  MAX_GIFT_MESSAGE_LENGTH,
  defaultGiftWrapping,
  normalizeGiftMessage,
  normalizeGiftType,
  calculateGiftWrappingFee,
  prepareGiftWrapping,
  addGiftWrappingToTotal
};
