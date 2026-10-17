
/*
=========================================
 MEMORA CREATIONS
 ADMIN ROUTES

 FULL REPLACEMENT CODE

 ADMIN LOGIN / LOGOUT
 DASHBOARD
 PRODUCTS
 CATEGORIES
 ORDERS
 COD PAYMENT
 CASHFREE PAYMENT VERIFICATION
 CASHFREE INSPECTION
 SHIPROCKET
 CLOUDINARY
 USERS
=========================================
*/

const router = require('express').Router();

const adminController =
  require('../controllers/adminController');

const {
  requireAdmin
} = require('../middleware/auth');

const cloudinaryController =
  require('../controllers/cloudinaryController');

const shiprocketController =
  require('../controllers/shiprocketController');

const codPaymentController =
  require('../controllers/codPaymentController');

const cashfreeCancellationReviewController =
  require('../controllers/cashfreeCancellationReviewController');

const {
  configured: shiprocketConfigured,
  getShiprocketToken
} = require('../services/shiprocketService');

const {
  inspectOldCashfreeOrders
} = require('../services/cashfreeCleanupService');


/* =====================================
   ADMIN AUTHENTICATION
===================================== */

router.post(
  '/login',
  adminController.login
);

router.post(
  '/logout',
  adminController.logout
);


/* =====================================
   ADMIN LOGIN REQUIRED

   ALL ROUTES BELOW ARE PROTECTED
===================================== */

router.use(requireAdmin);


/* =====================================
   DASHBOARD
===================================== */

router.get(
  '/dashboard',
  adminController.dashboard
);


/* =====================================
   CASHFREE PENDING INSPECTION

   READ ONLY

   GET /api/admin/cashfree/inspect
===================================== */

router.get(
  '/cashfree/inspect',
  async (req, res) => {

    try {

      const minutes = Number(
        req.query.minutes ?? 60
      );

      const limit = Number(
        req.query.limit ?? 20
      );

      if (
        !Number.isInteger(minutes) ||
        minutes < 1 ||
        minutes > 10080
      ) {

        return res.status(400).json({
          success: false,
          message:
            'Minutes must be between 1 and 10080.'
        });

      }

      if (
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100
      ) {

        return res.status(400).json({
          success: false,
          message:
            'Limit must be between 1 and 100.'
        });

      }

      const report =
        await inspectOldCashfreeOrders({
          olderThanMinutes: minutes,
          limit
        });

      return res.status(200).json({
        success: true,
        message:
          'Cashfree inspection completed.',
        ...report
      });

    } catch (err) {

      console.error(
        'Cashfree inspection failed:',
        err.message
      );

      return res.status(500).json({
        success: false,
        message:
          'Cashfree inspection failed. Check server logs.'
      });

    }

  }
);


/* =====================================
   CLOUDINARY IMAGE UPLOAD
===================================== */

router.post(
  '/cloudinary/signature',
  cloudinaryController.signature
);


/* =====================================
   PRODUCTS
===================================== */

router.get(
  '/products',
  adminController.listProducts
);

router.post(
  '/products',
  adminController.createProduct
);

router.put(
  '/products/:id',
  adminController.updateProduct
);

router.delete(
  '/products/:id',
  adminController.deleteProduct
);


/* =====================================
   CATEGORIES
===================================== */

router.post(
  '/categories',
  adminController.createCategory
);

router.put(
  '/categories/:id',
  adminController.updateCategory
);

router.delete(
  '/categories/:id',
  adminController.deleteCategory
);


/* =====================================
   ADMIN ORDERS
===================================== */

router.get(
  '/orders',
  adminController.listOrders
);

router.put(
  '/orders/:id',
  adminController.updateOrder
);


/* =====================================
   CASHFREE CANCELLATION
   PAYMENT VERIFICATION

   GET:
   /api/admin/orders/:id/cashfree/verify

   READ ONLY

   Checks:
   - Cashfree Order Status
   - Payment Attempts
   - Successful Payments
   - Pending Payments
   - Expired Payments

   DOES NOT:
   - Cancel Order
   - Initiate Refund
   - Release Stock
   - Change Payment Status
===================================== */

router.get(
  '/orders/:id/cashfree/verify',
  cashfreeCancellationReviewController
    .verifyCancellationPayment
);


/* =====================================
   COD MARK AS PAID

   PATCH:
   /api/admin/orders/:id/cod/paid

   Body:
   {
     "confirmed": true
   }

   Only delivered COD orders with
   pending payment can be marked Paid.
===================================== */

router.patch(
  '/orders/:id/cod/paid',
  codPaymentController.markCodPaid
);


/* =====================================
   SHIPROCKET CONNECTION TEST
===================================== */

router.get(
  '/shiprocket/test',
  async (req, res) => {

    try {

      if (!shiprocketConfigured()) {

        return res.status(500).json({
          success: false,
          message:
            'Shiprocket credentials are not configured.'
        });

      }

      await getShiprocketToken();

      return res.json({
        success: true,
        message:
          'Shiprocket connected successfully.'
      });

    } catch (err) {

      console.error(
        'Shiprocket connection test failed:',
        err
      );

      return res.status(500).json({
        success: false,
        message:
          err.message ||
          'Shiprocket connection failed.'
      });

    }

  }
);


/* =====================================
   SHIPROCKET COURIER RATES
===================================== */

router.post(
  '/orders/:id/check-couriers',
  shiprocketController.checkCourierRates
);


/* =====================================
   CREATE SHIPROCKET SHIPMENT
===================================== */

router.post(
  '/orders/:id/create-shipment',
  shiprocketController.createShipment
);


/* =====================================
   USERS
===================================== */

router.get(
  '/users',
  adminController.listUsers
);

router.get(
  '/users/:id/orders',
  adminController.userOrders
);

router.patch(
  '/users/:id/toggle',
  adminController.toggleUser
);


/* =====================================
   ADMIN RESET CUSTOMER PASSWORD
===================================== */

router.patch(
  '/users/:id/password',
  adminController.resetUserPassword
);


/* =====================================
   EXPORT ROUTER
===================================== */

module.exports = router;
