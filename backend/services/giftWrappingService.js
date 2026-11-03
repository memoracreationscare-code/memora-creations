
'use strict';

/*
=========================================
 MEMORA CREATIONS
 GIFT WRAPPING SERVICE

 STEP 3 - BACKEND PREPARATION

 Features:
 - Standard / Premium options
 - Personal gift message validation
 - Server-controlled pricing
 - Safe default for existing orders

 IMPORTANT:
 Gift wrapping is currently DISABLED.
 No additional charges will be applied.
=========================================
*/


/* =====================================
   CONFIGURATION
===================================== */

const GIFT_WRAPPING_ENABLED = false;

const MAX_GIFT_MESSAGE_LENGTH = 180;


/*
  Prices are placeholders until
  the business confirms actual fees.

  Do not enable the feature until
  COD, Cashfree, checkout preview
  and order saving are integrated.
*/

const GIFT_WRAPPING_PRICES = Object.freeze({
  NONE: 0,
  STANDARD: 0,
  PREMIUM: 0
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
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value !== 'string') {
    throw new Error(
      'Gift message must be text.'
    );
  }

  const message = value.trim();

  if (message.length > MAX_GIFT_MESSAGE_LENGTH) {
    throw new Error(
      `Gift message cannot exceed ${MAX_GIFT_MESSAGE_LENGTH} characters.`
    );
  }

  return message;
}


/* =====================================
   CHECK GIFT TYPE
===================================== */

function normalizeGiftType(value) {
  const type = String(
    value || 'NONE'
  ).trim().toUpperCase();

  if (!Object.prototype.hasOwnProperty.call(
    GIFT_WRAPPING_PRICES,
    type
  )) {
    throw new Error(
      'Invalid gift wrapping option.'
    );
  }

  return type;
}


/* =====================================
   CALCULATE FEE

   Never accept gift fee sent by
   the customer's browser.
===================================== */

function calculateGiftWrappingFee(type) {
  const normalizedType = normalizeGiftType(type);

  if (!GIFT_WRAPPING_ENABLED) {
    if (normalizedType !== 'NONE') {
      throw new Error(
        'Gift wrapping is not available yet.'
      );
    }

    return 0;
  }

  const fee = GIFT_WRAPPING_PRICES[
    normalizedType
  ];

  if (
    !Number.isFinite(fee) ||
    fee < 0
  ) {
    throw new Error(
      'Gift wrapping price configuration is invalid.'
    );
  }

  return Math.round(fee * 100) / 100;
}


/* =====================================
   VALIDATE AND PREPARE GIFT WRAPPING

   Input from checkout is untrusted.

   Fee is always calculated here.
===================================== */

function prepareGiftWrapping(input = null) {
  if (input === null || input === undefined) {
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

  const selected = input.selected === true;

  const type = normalizeGiftType(
    input.type || 'NONE'
  );

  const message = normalizeGiftMessage(
    input.message
  );

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

  if (!selected) {
    return defaultGiftWrapping();
  }

  if (type === 'NONE') {
    throw new Error(
      'Please select a gift wrapping option.'
    );
  }

  return {
    selected: true,
    type,
    fee: calculateGiftWrappingFee(type),
    message
  };
}


/* =====================================
   ADD GIFT FEE TO TRUSTED ORDER TOTAL

   This helper will be connected
   to server-side order pricing later.
===================================== */

function addGiftWrappingToTotal(
  baseTotal,
  giftWrapping
) {
  const baseAmount = Number(baseTotal);

  if (
    !Number.isFinite(baseAmount) ||
    baseAmount < 0
  ) {
    throw new Error(
      'Invalid order total.'
    );
  }

  const gift = prepareGiftWrapping(
    giftWrapping
  );

  const grandTotal = Math.round(
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
