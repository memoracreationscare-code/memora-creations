
'use strict';

/*
========================================
 MEMORA CREATIONS
 COUPON PRICING SERVICE

 Coupon + Gift Wrapping Preparation

 FEATURES:
 - Trusted database prices
 - Coupon validation
 - Delivery charge calculation
 - Gift wrapping fee calculation
 - Safe final order amount

 IMPORTANT:
 Gift wrapping is currently disabled
 in giftWrappingService.js.

 Existing COD and Cashfree pricing
 remains unchanged.
========================================
*/

const {
  getTrustedItems,
  totals,
  money
} = require('./orderService');

const {
  normalizeCoupon,
  validateCoupon
} = require('./couponService');

const {
  prepareGiftWrapping
} = require('./giftWrappingService');

const {
  error
} = require('../utils/http');


/* =====================================
   CALCULATE COUPON PRICING
===================================== */

async function calculateCouponPricing({
  items,
  couponCode = null,
  userId = null,
  giftWrapping = null
}) {

  /*
  =====================================
   TRUSTED PRODUCT PRICES

   Never trust product prices
   or totals sent by the browser.
  =====================================
  */

  const trustedItems = await getTrustedItems(
    items
  );

  const base = totals(trustedItems);


  /*
  =====================================
   VALIDATE GIFT WRAPPING

   The gift wrapping service controls
   availability, options and fees.
  =====================================
  */

  let gift;

  try {
    gift = prepareGiftWrapping(
      giftWrapping
    );
  } catch (err) {
    throw error(
      400,
      err.message || 'Invalid gift wrapping.'
    );
  }

  const giftWrappingFee = money(
    gift.fee
  );


  /*
  =====================================
   COUPON VALIDATION
  =====================================
  */

  const code = normalizeCoupon(
    couponCode
  );

  let coupon = null;

  let couponDiscount = 0;

  if (code) {

    if (!userId) {
      throw error(
        401,
        'Login required to apply a coupon.'
      );
    }

    coupon = await validateCoupon({
      code,
      subtotal: base.subtotal,
      userId
    });

    couponDiscount = money(
      coupon.discount
    );
  }


  /*
  =====================================
   FINAL TOTAL

   Product subtotal
   + Delivery charge
   + Gift wrapping fee
   - Coupon discount

   Gift wrapping fee is currently 0.
  =====================================
  */

  const grandTotal = money(
    base.subtotal +
    base.deliveryCharge +
    giftWrappingFee -
    couponDiscount
  );


  /*
  =====================================
   SAFETY VALIDATION
  =====================================
  */

  if (
    !Number.isFinite(grandTotal) ||
    grandTotal < 0
  ) {
    throw error(
      400,
      'Invalid discounted order amount.'
    );
  }


  /*
  =====================================
   RETURN TRUSTED PRICING
  =====================================
  */

  return {

    subtotal: base.subtotal,

    original: base.original,

    productSavings: base.discount,

    deliveryCharge: base.deliveryCharge,

    couponCode: coupon
      ? coupon.couponCode
      : null,

    couponId: coupon
      ? coupon.couponId
      : null,

    couponDiscount,

    giftWrapping: gift,

    giftWrappingFee,

    grandTotal,

    couponApplied: Boolean(coupon)
  };

}


/* =====================================
   EXPORT
===================================== */

module.exports = {
  calculateCouponPricing
};
