
'use strict';

/*
==========================================
 MEMORA CREATIONS
 DELIVERY PIN CODE API

 GET /api/delivery/check

 Example:
 ?pincode=274304&paymentMethod=COD

 Read-only courier availability.
 No order or payment modifications.
==========================================
*/

const router = require('express').Router();

const rateLimit = require('express-rate-limit');

const {
  checkDeliveryPincode
} = require('../services/deliveryPincodeService');


/*
==========================================
 RATE LIMIT

 Limits repeated Shiprocket API calls.
==========================================
*/

const deliveryCheckLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    available: null,
    message:
      'Too many delivery checks. Please try again later.'
  }
});

router.use(deliveryCheckLimiter);


/*
==========================================
 CHECK DELIVERY AVAILABILITY
==========================================
*/

router.get('/check', async (req, res) => {

  try {

    const pincode =
      typeof req.query.pincode === 'string'
        ? req.query.pincode
        : '';

    const paymentMethod =
      typeof req.query.paymentMethod === 'string'
        ? req.query.paymentMethod
        : 'PREPAID';

    const result = await checkDeliveryPincode({
      pincode,
      paymentMethod
    });

    if (result.reason === 'INVALID_PINCODE' ||
        result.reason === 'INVALID_PAYMENT_METHOD') {

      return res.status(400).json(result);

    }

    if (!result.success) {

      return res.status(503).json(result);

    }

    return res.status(200).json(result);

  } catch (err) {

    console.error(
      '[Delivery API] Unexpected error:',
      err.message
    );

    return res.status(503).json({
      success: false,
      available: null,
      message:
        'Delivery availability is temporarily unavailable.'
    });

  }

});


/*
==========================================
 EXPORT
==========================================
*/

module.exports = router;
