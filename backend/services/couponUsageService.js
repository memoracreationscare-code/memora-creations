
/*
========================================
 MEMORA CREATIONS
 COUPON USAGE SERVICE

 Atomic Total and Per-Customer
 Coupon Reservation
========================================
*/

const {
  Coupon,
  CouponUserUsage
} = require('../models');

const { error } = require('../utils/http');

const {
  validateCoupon,
  normalizeCoupon
} = require('./couponService');

/*
========================================
 RESERVE COUPON

 This function MUST be called inside
 the order creation transaction.

 Both counters and the order must
 commit or roll back together.
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

  /*
   Reserve one slot in the coupon's
   total usage counter.
  */

  const coupon = await Coupon.findOneAndUpdate(
    {
      _id: validated.couponId,

      isActive: true,

      startsAt: { $lte: now },

      expiresAt: { $gt: now },

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

  /*
   Reserve one slot for this customer.

   The compound unique index on
   {coupon, user} prevents duplicate
   counter documents.

   This uses the SAME transaction as
   the global coupon reservation.
  */

  try {
    const customerUsage =
      await CouponUserUsage.findOneAndUpdate(
        {
          coupon: coupon._id,

          user: userId,

          usedCount: {
            $lt: coupon.perUserLimit
          }
        },
        {
          $inc: {
            usedCount: 1
          },

          $setOnInsert: {
            coupon: coupon._id,
            user: userId
          }
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          session
        }
      );

    if (
      !customerUsage ||
      customerUsage.usedCount >
        coupon.perUserLimit
    ) {
      throw error(
        409,
        'You have reached your coupon usage limit.'
      );
    }

  } catch (err) {
    /*
     A duplicate key can occur when
     the customer already has a usage
     document at the allowed limit.

     Do not manually release the global
     counter here: the surrounding
     transaction must roll back.
    */

    if (err && err.code === 11000) {
      throw error(
        409,
        'You have reached your coupon usage limit.'
      );
    }

    throw err;
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

 Called on eligible COD cancellation.

 The caller MUST:
 1. Check couponUsageReserved.
 2. Call inside the same transaction.
 3. Set couponUsageReserved = false.
 4. Save the cancelled order.

 Never call twice for one reservation.
========================================
*/

async function releaseCoupon({
  couponId,
  userId,
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

  if (!userId) {
    throw new Error(
      'Customer ID is required to release coupon usage.'
    );
  }

  /*
   Release one global coupon slot.
  */

  await Coupon.updateOne(
    {
      _id: couponId,

      usedCount: {
        $gt: 0
      }
    },
    {
      $inc: {
        usedCount: -1
      }
    },
    {
      session
    }
  );

  /*
   Release one customer coupon slot.

   The document may be absent for
   historical orders created before
   customer counters were introduced.
  */

  await CouponUserUsage.updateOne(
    {
      coupon: couponId,

      user: userId,

      usedCount: {
        $gt: 0
      }
    },
    {
      $inc: {
        usedCount: -1
      }
    },
    {
      session
    }
  );
}

module.exports = {
  reserveCoupon,
  releaseCoupon
};
