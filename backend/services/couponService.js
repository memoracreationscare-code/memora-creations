
/*
========================================
 MEMORA CREATIONS
 COUPON SERVICE
 Secure Discount Calculation
========================================
*/

const {
  Coupon,
  Order
} = require('../models');

const {
  error
} = require('../utils/http');

function roundMoney(value) {
  return Math.round(
    (Number(value) + Number.EPSILON) * 100
  ) / 100;
}

function normalizeCoupon(code) {
  return String(code || '')
    .trim()
    .toUpperCase();
}

/*
========================================
 VALIDATE COUPON AND CALCULATE DISCOUNT

 Does not consume coupon usage.
 Usage reservation/consumption will be
 integrated with order/payment flows.
========================================
*/

async function validateCoupon({
  code,
  subtotal,
  userId = null
}) {
  const couponCode = normalizeCoupon(code);

  if (!/^[A-Z0-9_-]{3,30}$/.test(couponCode)) {
    throw error(400, 'Invalid coupon code.');
  }

  const amount = Number(subtotal);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw error(400, 'Invalid order subtotal.');
  }

  const coupon = await Coupon.findOne({
    code: couponCode
  }).lean();

  if (!coupon) {
    throw error(
      404,
      'Coupon code not found.'
    );
  }

  if (!coupon.isActive) {
    throw error(
      400,
      'This coupon is disabled.'
    );
  }

  const now = new Date();

  if (
    coupon.startsAt &&
    now < new Date(coupon.startsAt)
  ) {
    throw error(
      400,
      'This coupon is not active yet.'
    );
  }

  if (
    !coupon.expiresAt ||
    now >= new Date(coupon.expiresAt)
  ) {
    throw error(
      400,
      'This coupon has expired.'
    );
  }

  if (
    coupon.usedCount >= coupon.usageLimit
  ) {
    throw error(
      400,
      'Coupon usage limit reached.'
    );
  }

  if (amount < coupon.minOrderAmount) {
    throw error(
      400,
      `Minimum order amount is ₹${coupon.minOrderAmount}.`
    );
  }

  if (userId) {
    const previousUses = await Order.countDocuments({
      user: userId,
      couponCode: couponCode,
      orderStatus: {
        $ne: 'Cancelled'
      },
      paymentStatus: {
        $nin: [
          'FAILED',
          'CANCELLED'
        ]
      }
    });

    if (previousUses >= coupon.perUserLimit) {
      throw error(
        400,
        'You have reached your coupon usage limit.'
      );
    }
  }

  let discount = 0;

  if (coupon.discountType === 'PERCENTAGE') {
    discount =
      amount * coupon.discountValue / 100;

  } else if (coupon.discountType === 'FIXED') {
    discount = coupon.discountValue;

  } else {
    throw error(
      400,
      'Invalid coupon discount type.'
    );
  }

  if (
    coupon.maxDiscountAmount !== null &&
    coupon.maxDiscountAmount !== undefined
  ) {
    discount = Math.min(
      discount,
      coupon.maxDiscountAmount
    );
  }

  discount = roundMoney(
    Math.max(
      0,
      Math.min(discount, amount)
    )
  );

  return {
    couponId: coupon._id,
    couponCode: coupon.code,
    discount,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    subtotal: roundMoney(amount),
    discountedSubtotal: roundMoney(
      amount - discount
    )
  };
}

module.exports = {
  normalizeCoupon,
  validateCoupon
};
