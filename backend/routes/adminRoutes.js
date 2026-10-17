
/*
=========================================
 MEMORA CREATIONS
 ADMIN ROUTES

 DASHBOARD
 PRODUCTS
 CATEGORIES
 ORDERS
 COD PAYMENT
 CASHFREE VERIFICATION
 SANDBOX CANCELLATION APPROVAL
 CLOUDINARY
 SHIPROCKET
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

const cashfreeReviewController =
  require('../controllers/cashfreeCancellationReviewController');

const cashfreeApprovalController =
  require('../controllers/cashfreeCancellationApprovalController');

const {
  configured: shiprocketConfigured,
  getShiprocketToken
} = require('../services/shiprocketService');

const {
  inspectOldCashfreeOrders
} = require('../services/cashfreeCleanupService');


/* =====================================
   ADMIN LOGIN / LOGOUT
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
   ADMIN SECURITY
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
          'Cashfree inspection failed.'
      });

    }
  }
);


/* =====================================
   CLOUDINARY
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
   ORDERS
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
   CASHFREE VERIFY PAYMENT

   READ ONLY
===================================== */

router.get(
  '/orders/:id/cashfree/verify',
  cashfreeReviewController
    .verifyCancellationPayment
);


/* =====================================
   SANDBOX APPROVAL SECURITY

   CONDITIONS:

   1. Admin must be logged in
   2. Cashfree environment = sandbox
   3. Explicit server-side enable required

   Disabled by default.
   Never enabled in production.
===================================== */

function requireSandboxApproval(req, res, next) {

  const environment = String(
    process.env.CASHFREE_ENV || 'sandbox'
  ).trim().toLowerCase();

  const enabled =
    process.env
      .CASHFREE_CANCELLATION_APPROVAL_ENABLED
      === 'true';

  if (
    environment !== 'sandbox' ||
    !enabled
  ) {

    return res.status(403).json({
      success: false,
      message:
        'Cashfree cancellation approval is disabled.'
    });

  }

  return next();
}


/* =====================================
   CASHFREE CANCELLATION APPROVAL

   SANDBOX ONLY

   POST:
   /api/admin/orders/:id/cashfree/approve

   BODY:
   {
     "confirmed": true
   }

   Additional payment checks happen
   inside the approval controller.
===================================== */

router.post(
  '/orders/:id/cashfree/approve',
  requireSandboxApproval,
  cashfreeApprovalController.approveCancellation
);


/* =====================================
   COD MARK AS PAID
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
   SHIPROCKET SHIPMENT CREATION
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
   RESET CUSTOMER PASSWORD
===================================== */

router.patch(
  '/users/:id/password',
  adminController.resetUserPassword
);


/* =====================================
   EXPORT
===================================== */

module.exports = router;
