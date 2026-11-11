
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


/* ==========================================
   PUBLIC PRODUCT-PAGE PIN CHECK (no login)

   POST /api/delivery/product-check
   { "pincode": "274305", "productId": "<mongo id>" }

   Read-only. Answers "delivery here? COD? how many days?"
   Results are kept for 10 minutes so many visitors do not
   hammer Shiprocket. Same strict weight rules as above.
========================================== */

const productCheckCache = new Map();
const PRODUCT_CHECK_TTL = 10 * 60 * 1000;

const productCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    available: null,
    reason: 'RATE_LIMIT',
    message: 'Too many checks. Please try again in a few minutes.'
  }
});

function summarise(prepaid, cod) {
  return {
    success: true,
    pincode: prepaid.pincode,
    available: prepaid.available === true,
    codAvailable: cod && cod.success ? cod.available === true : null,
    estimatedDeliveryDays: prepaid.estimatedDeliveryDays ?? null,
    estimatedDeliveryDate: prepaid.estimatedDeliveryDate || null,
    message: prepaid.available
      ? 'Delivery is available for this PIN code.'
      : 'Sorry, we do not deliver to this PIN code yet.'
  };
}

async function productCheck(req, res, check = checkDeliveryPincode, cache = productCheckCache, now = Date.now()) {
  const body = req.body || {};
  const pincode = typeof body.pincode === 'string' ? body.pincode.trim() : '';
  const productId = typeof body.productId === 'string' ? body.productId.trim() : '';

  if (!/^[1-9][0-9]{5}$/.test(pincode)) {
    return res.status(400).json({
      success: false, available: null, reason: 'INVALID_PINCODE',
      message: 'Enter a valid 6-digit PIN code.'
    });
  }

  if (!/^[a-f0-9]{24}$/i.test(productId)) {
    return res.status(400).json({
      success: false, available: null, reason: 'INVALID_ITEMS',
      message: 'Product not found.'
    });
  }

  const key = pincode + ':' + productId;
  const hit = cache.get(key);

  if (hit && now - hit.at < PRODUCT_CHECK_TTL) return res.status(200).json(hit.value);

  const items = [{ productId, quantity: 1 }];
  const [prepaid, cod] = await Promise.all([
    check({ pincode, paymentMethod: 'PREPAID', items }),
    check({ pincode, paymentMethod: 'COD', items })
  ]);

  if (!prepaid.success) {
    const status = prepaid.reason === 'INVALID_PINCODE' ? 400
      : prepaid.reason === 'PRODUCT_UNAVAILABLE' ? 409
      : (prepaid.reason === 'SHIPPING_DETAILS_MISSING' || prepaid.reason === 'INVALID_PACKAGE_WEIGHT') ? 422
      : 503;

    return res.status(status).json({
      success: false, available: null, reason: prepaid.reason,
      message: status === 503
        ? 'Delivery check abhi available nahi hai. Checkout par PIN code check ho jayega.'
        : prepaid.message
    });
  }

  const value = summarise(prepaid, cod);

  if (cache.size > 500) cache.clear();
  cache.set(key, { at: now, value });

  return res.status(200).json(value);
}

router.post('/product-check', productCheckLimiter, (req, res) =>
  productCheck(req, res).catch(err => {
    console.error('[Delivery API] product-check failed:', err.message);
    res.status(503).json({
      success: false, available: null, reason: 'DELIVERY_CHECK_FAILED',
      message: 'Delivery check abhi available nahi hai.'
    });
  })
);

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
module.exports.productCheck = productCheck;
