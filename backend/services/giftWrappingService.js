
'use strict';

/*
=========================================
 MEMORA CREATIONS
 GIFT WRAPPING SERVICE

 LIVE WEBSITE INTEGRATION

 Normal Packaging  = INR 0
 Standard Wrapping = INR 29
 Premium Wrapping  = INR 59

 FEATURES:
 - Production feature switch
 - Server-controlled pricing
 - Gift message validation
 - Safe default for existing orders
 - COD and Cashfree support
 - Client fee manipulation protection

 IMPORTANT:
 Disabled by default.
=========================================
*/


/* =====================================
   LIVE FEATURE CONFIGURATION

   Render Environment Variable:

   GIFT_WRAPPING_LIVE_ENABLED=true

   If missing or false,
   Gift Wrapping remains disabled.
===================================== */

const GIFT_WRAPPING_ENABLED =
  String(
    process.env.GIFT_WRAPPING_LIVE_ENABLED ||
    'false'
  ).trim().toLowerCase() === 'true';


/* =====================================
   PRICES AND MESSAGE LIMIT
===================================== */

const MAX_GIFT_MESSAGE_LENGTH = 180;

const GIFT_WRAPPING_PRICES =
  Object.freeze({
    NONE: 0,
    STANDARD: 29,
    PREMIUM: 59
  });


/* =====================================
   DEFAULT GIFT WRAPPING
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
   NORMALIZE GIFT MESSAGE
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
   VALIDATE GIFT TYPE
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
   CALCULATE TRUSTED GIFT FEE

   Never accept price from frontend.
===================================== */

function calculateGiftWrappingFee(type) {
  const normalizedType =
    normalizeGiftType(type);

  /*
    When feature is disabled,
    only normal packaging is allowed.
  */

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
   PREPARE GIFT WRAPPING

   Validates customer selection.

   Missing input means normal
   packaging at no extra charge.
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


  /* =================================
     FEATURE DISABLED
  ================================= */

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


  /* =================================
     NORMAL PACKAGING
  ================================= */

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


  /* =================================
     REQUIRE PAID WRAPPING
  ================================= */

  if (type === 'NONE') {
    throw new Error(
      'Please select a gift wrapping option.'
    );
  }


  /* =================================
     SERVER CALCULATES FEE
  ================================= */

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
   ADD GIFT WRAPPING TO ORDER TOTAL

   Used for trusted server pricing.
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
