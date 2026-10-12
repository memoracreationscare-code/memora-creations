
/*
=========================================
 MEMORA CREATIONS
 ADMIN ROUTES

 ADMIN AUTHENTICATION
 DASHBOARD
 PRODUCTS
 CATEGORIES
 ORDERS
 USERS
 CLOUDINARY
 SHIPROCKET
 CASHFREE INSPECTION
=========================================
*/

const router =
  require('express').Router();

const c =
  require('../controllers/adminController');

const {
  requireAdmin
} = require('../middleware/auth');

const cloudinaryController =
  require('../controllers/cloudinaryController');

const shiprocketController =
  require('../controllers/shiprocketController');

const {
  configured: shiprocketConfigured,
  getShiprocketToken
} = require('../services/shiprocketService');

const {
  inspectOldCashfreeOrders
} = require('../services/cashfreeCleanupService');


/* =====================================
   ADMIN AUTH
===================================== */

router.post(
  '/login',
  c.login
);

router.post(
  '/logout',
  c.logout
);


/* =====================================
   ADMIN LOGIN REQUIRED

   All routes below require a
   valid Admin login session.
===================================== */

router.use(requireAdmin);


/* =====================================
   CASHFREE PENDING ORDER INSPECTION

   GET /api/admin/cashfree/inspect

   Read-only:
   No order modifications
   No stock release
   No payment status changes
===================================== */

router.get(
  '/cashfree/inspect',
  async (req, res) => {

    try {

      /*
        Optional query parameters:

        ?minutes=60&limit=20

        Defaults:
        60 minutes
        20 orders
      */

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
   CLOUDINARY
===================================== */

router.post(
  '/cloudinary/signature',
  cloudinaryController.signature
);


/* =====================================
   DASHBOARD
===================================== */

router.get(
  '/dashboard',
  c.dashboard
);


/* =====================================
   PRODUCTS
===================================== */

router.get(
  '/products',
  c.listProducts
);

router.post(
  '/products',
  c.createProduct
);

router.put(
  '/products/:id',
  c.updateProduct
);

router.delete(
  '/products/:id',
  c.deleteProduct
);


/* =====================================
   CATEGORIES
===================================== */

router.post(
  '/categories',
  c.createCategory
);

router.put(
  '/categories/:id',
  c.updateCategory
);

router.delete(
  '/categories/:id',
  c.deleteCategory
);


/* =====================================
   ORDERS
===================================== */

router.get(
  '/orders',
  c.listOrders
);

router.put(
  '/orders/:id',
  c.updateOrder
);


/* =====================================
   CHECK COURIER RATES
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
  c.listUsers
);

router.get(
  '/users/:id/orders',
  c.userOrders
);

router.patch(
  '/users/:id/toggle',
  c.toggleUser
);


/* =====================================
   ADMIN RESET USER PASSWORD
===================================== */

router.patch(
  '/users/:id/password',
  c.resetUserPassword
);


/* =====================================
   EXPORT ROUTER
===================================== */

module.exports = router;
