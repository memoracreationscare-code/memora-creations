
/*
========================================
 MEMORA CREATIONS
 CUSTOMER COUPON ROUTES
 Secure Coupon Preview
========================================
*/

const router = require('express').Router();

const {
  requireUser
} = require('../middleware/auth');

const {
  asyncHandler,
  error,
  ok
} = require('../utils/http');

const {
  getTrustedItems,
  totals,
  money
} = require('../services/orderService');

const {
  validateCoupon
} = require('../services/couponService');

/*
========================================
 POST /api/coupons/validate

 BODY:
 {
   "code": "WELCOME10",
   "items": [
     {
       "productId": "PRODUCT_MONGO_ID",
       "quantity": 1
     }
   ]
 }

 This endpoint does NOT:
 - Create an order
 - Reserve a coupon
 - Increment usage
 - Charge any payment
========================================
*/

router.post(
  '/validate',
  requireUser,
  asyncHandler(async (req, res) => {

    const code = String(
      req.body?.code || ''
    ).trim();

    if (!code) {
      throw error(
        400,
        'Please enter a coupon code.'
      );
    }

    // Get real prices from database.
    const trustedItems = await getTrustedItems(
      req.body?.items
    );

    // Existing order pricing.
    const amount = totals(trustedItems);

    // Check coupon against trusted subtotal.
    const coupon = await validateCoupon({
      code,
      subtotal: amount.subtotal,
      userId: req.user._id
    });

    const couponDiscount = money(
      coupon.discount
    );

    const grandTotal = money(
      Math.max(
        0,
        amount.subtotal -
          couponDiscount +
          amount.deliveryCharge
      )
    );

    return ok(res, {
      valid: true,

      coupon: {
        code: coupon.couponCode,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue
      },

      pricing: {
        subtotal: amount.subtotal,

        original: amount.original,

        productSavings: amount.discount,

        deliveryCharge: amount.deliveryCharge,

        couponDiscount,

        grandTotal
      },

      message: 'Coupon applied successfully.'
    });

  })
);

module.exports = router;
