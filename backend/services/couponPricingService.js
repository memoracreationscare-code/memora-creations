
/*
========================================
 MEMORA CREATIONS
 COUPON PRICING SERVICE

 Server-side price quotation
 Does not reserve or consume coupons.
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

const { error } = require('../utils/http');

async function calculateCouponPricing({
  items,
  couponCode = null,
  userId = null
}) {
  // Never trust totals sent by the browser.
  const trustedItems = await getTrustedItems(items);

  const base = totals(trustedItems);

  const code = normalizeCoupon(couponCode);

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

    couponDiscount = money(coupon.discount);
  }

  const grandTotal = money(
    base.subtotal +
    base.deliveryCharge -
    couponDiscount
  );

  if (
    !Number.isFinite(grandTotal) ||
    grandTotal < 0
  ) {
    throw error(
      400,
      'Invalid discounted order amount.'
    );
  }

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

    grandTotal,

    couponApplied: Boolean(coupon)
  };
}

module.exports = {
  calculateCouponPricing
};
