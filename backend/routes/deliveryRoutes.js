
'use strict';

/*
==========================================
 MEMORA CREATIONS
 SHIPROCKET DELIVERY ROUTES - VERSION 2

 POST /api/delivery/check
 - Customer login required
 - Accepts product IDs and quantities
 - Product weight verified from MongoDB
 - Supports COD and PREPAID
 - Read-only courier serviceability
 - No order or payment modification

 GET /api/delivery/check
 - Legacy endpoint preserved
 - Directs callers to POST with items
==========================================
*/

const router = require('express').Router();

const rateLimit = require('express-rate-limit');

const {
  requireUser
} = require('../middleware/auth');

const {
  checkDeliveryPincode
} = require('../services/deliveryPincodeService');


/* ==========================================
   DELIVERY RATE LIMIT
========================================== */

const deliveryCheckLimiter = rateLimit({

  windowMs: 15 * 60 * 1000,

  limit: 30,

  standardHeaders: 'draft-7',

  legacyHeaders: false,

  message: {
    success: false,
    available: null,
    reason: 'RATE_LIMIT',
    message:
      'Too many delivery checks. Please try again later.'
  }

});

router.use(deliveryCheckLimiter);


/* ==========================================
   LEGACY GET ROUTE

   Dynamic product weight requires
   product IDs and quantities.

   Never use invented parcel weight.
========================================== */

router.get('/check', (_req, res) => {

  return res.status(400).json({

    success: false,

    available: null,

    reason: 'PRODUCT_ITEMS_REQUIRED',

    message:
      'Use POST /api/delivery/check with valid products and quantities.'

  });

});


/* ==========================================
   POST DELIVERY CHECK

   Request body:

   {
     "pincode": "274305",
     "paymentMethod": "PREPAID",
     "items": [
       {
         "productId": "MongoDBProductId",
         "quantity": 1
       }
     ]
   }

   No shipping weight is accepted
   from the browser.

   Weight is fetched by the service
   using trusted MongoDB products.
========================================== */

router.post(
  '/check',
  requireUser,
  async (req, res) => {

    try {

      const body = req.body || {};

      const pincode =
        typeof body.pincode === 'string'
          ? body.pincode
          : '';

      const paymentMethod =
        typeof body.paymentMethod === 'string'
          ? body.paymentMethod
          : 'PREPAID';

      const items = body.items;

      if (
        !Array.isArray(items) ||
        items.length === 0 ||
        items.length > 100
      ) {

        return res.status(400).json({

          success: false,

          available: null,

          reason: 'INVALID_ITEMS',

          message:
            'Please provide valid products for delivery checking.'

        });

      }

      const result =
        await checkDeliveryPincode({

          pincode,

          paymentMethod,

          items

        });

      if (
        result.reason === 'INVALID_PINCODE' ||
        result.reason === 'INVALID_PAYMENT_METHOD' ||
        result.reason === 'INVALID_ITEMS'
      ) {

        return res.status(400).json(
          result
        );

      }

      if (
        result.reason === 'PRODUCT_UNAVAILABLE'
      ) {

        return res.status(409).json(
          result
        );

      }

      if (
        result.reason === 'SHIPPING_DETAILS_MISSING' ||
        result.reason === 'INVALID_PACKAGE_WEIGHT'
      ) {

        return res.status(422).json(
          result
        );

      }

      if (!result.success) {

        return res.status(503).json(
          result
        );

      }

      return res.status(200).json(
        result
      );

    } catch (err) {

      console.error(
        '[Delivery API] Delivery check failed:',
        err.message
      );

      return res.status(503).json({

        success: false,

        available: null,

        reason: 'DELIVERY_CHECK_FAILED',

        message:
          'Delivery checking is temporarily unavailable. Please try again later.'

      });

    }

  }
);


/* ==========================================
   EXPORT ROUTER
========================================== */

module.exports = router;
