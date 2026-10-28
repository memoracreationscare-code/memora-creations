
/*
========================================
 MEMORA CREATIONS
 COUPON USAGE SERVICE

 Atomic Coupon Reservation
========================================
*/

const { Coupon } = require('../models');

const { error } = require('../utils/http');

const {
  validateCoupon,
  normalizeCoupon
} = require('./couponService');

/*
========================================
 RESERVE COUPON

 Must be called inside the SAME MongoDB
 transaction used to save the order.

 Reservation is rolled back if the
 transaction fails.
========================================
*/

async function reserveCoupon({
  code,
  subtotal,
  userId,
  session
}) {
  if (!session) {
    throw new Error(
      'Coupon reservation requires a database transaction.'
    );
  }

  if (!userId) {
    throw error(
      400,
      'Customer account is required.'
    );
  }

  const couponCode = normalizeCoupon(code);

  const validated = await validateCoupon({
    code: couponCode,
    subtotal,
    userId
  });

  const now = new Date();

  const coupon = await Coupon.findOneAndUpdate(
    {
      _id: validated.couponId,

      isActive: true,

      startsAt: { $lte: now },

      expiresAt: { $gt: now },

      usedCount: {
        $lt: Number.MAX_SAFE_INTEGER
      },

      $expr: {
        $lt: [
          '$usedCount',
          '$usageLimit'
        ]
      }
    },
    {
      $inc: {
        usedCount: 1
      }
    },
    {
      new: true,
      session
    }
  );

  if (!coupon) {
    throw error(
      409,
      'Coupon is no longer available. Please try again.'
    );
  }

  return {
    couponId: coupon._id,
    couponCode: coupon.code,
    couponDiscount: validated.discount
  };
}

/*
========================================
 RELEASE COUPON RESERVATION

 Call only after the corresponding order
 reservation is confirmed eligible for
 release, inside a transaction.

 The order workflow must guarantee that
 each reservation is released once only.
========================================
*/

async function releaseCoupon({
  couponId,
  session
}) {
  if (!session) {
    throw new Error(
      'Coupon release requires a database transaction.'
    );
  }

  if (!couponId) {
    return;
  }

  await Coupon.updateOne(
    {
      _id: couponId,
      usedCount: { $gt: 0 }
    },
    {
      $inc: {
        usedCount: -1
      }
    },
    { session }
  );
}

module.exports = {
  reserveCoupon,
  releaseCoupon
};
