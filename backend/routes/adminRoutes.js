
'use strict';

/*
=========================================
 MEMORA CREATIONS
 ADMIN ROUTES
 SHIPROCKET SAFE MODE V1

 DEFAULT:
 - Live shipment creation DISABLED
 - Dry run ENABLED
 - Courier rate checks ENABLED
 - Existing shipment status ENABLED

 To enable real shipments later, set
 this Render environment variable:

 SHIPROCKET_LIVE_SHIPMENTS_ENABLED=true

 IMPORTANT:
 No client-side request can override
 this environment variable.
=========================================
*/

const router = require('express').Router();

const returnRequestController =
  require('../controllers/returnRequestController');

const adminController =
  require('../controllers/adminController');

const {
  requireAdmin
} = require('../middleware/auth');

const abandonedCartController =
  require('../controllers/abandonedCartController');

const codRemittanceController =
  require('../controllers/codRemittanceController');

const returnParcelController =
  require('../controllers/returnParcelController');

const cloudinaryController =
  require('../controllers/cloudinaryController');

const shiprocketController =
  require('../controllers/shiprocketController');

const shiprocketDryRunController =
  require('../controllers/shiprocketDryRunController');

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
   REQUIRE ADMIN AUTHENTICATION
===================================== */

router.use(requireAdmin);

// Helpers (role 'staff') can only reach the packing-work routes.
router.use(require('../middleware/staffGuard').staffGuard);

// Every change made from the admin panel is written to the activity log.
router.use(require('../middleware/auditLog').auditLog);

const staffController = require('../controllers/adminStaffController');

router.get('/me', staffController.me);
router.get('/staff', staffController.list);
router.post('/staff', staffController.create);
router.patch('/staff/:id/toggle', staffController.toggle);
router.patch('/staff/:id/password', staffController.resetPassword);

router.get(
  '/activity',
  require('../controllers/adminActivityController').list
);


/* =====================================
   ADMIN COUPON MANAGEMENT
===================================== */

router.use(
  '/coupons',
  require('./couponAdminRoutes')
);


/* =====================================
   CASHFREE SANDBOX REFUND STATUS
===================================== */

router.get(
  '/cashfree/refunds/initiation-status',
  (req, res) => {

    const enabled =
      process.env.CASHFREE_ENV === 'sandbox' &&
      process.env.CASHFREE_SANDBOX_REFUNDS_ENABLED
        === 'true';

    res.set('Cache-Control', 'no-store');

    return res.json({
      success: true,
      enabled,
      sandboxOnly: true
    });
  }
);


/* =====================================
   CASHFREE SANDBOX REFUND INITIATION
===================================== */

router.post(
  '/orders/:id/cashfree/refunds/initiate',
  require('../controllers/cashfreeRefundInitiationController')
    .initiateSandboxRefund
);


/* =====================================
   CASHFREE REFUND VERIFICATION
===================================== */

router.get(
  '/orders/:id/cashfree/refunds',
  require('../controllers/cashfreeRefundController')
    .inspectRefunds
);


/* =====================================
   DASHBOARD
===================================== */

router.get(
  '/dashboard',
  adminController.dashboard
);


/* =====================================
   CASHFREE APPROVAL CONFIGURATION
===================================== */

function isSandboxApprovalEnabled() {

  const environment = String(
    process.env.CASHFREE_ENV || 'sandbox'
  ).trim().toLowerCase();

  const enabled =
    process.env
      .CASHFREE_CANCELLATION_APPROVAL_ENABLED
      === 'true';

  return (
    environment === 'sandbox' &&
    enabled
  );
}


/* =====================================
   CASHFREE APPROVAL STATUS
===================================== */

router.get(
  '/cashfree/approval-status',
  (req, res) => {

    const enabled =
      isSandboxApprovalEnabled();

    return res.status(200).json({
      success: true,
      approvalEnabled: enabled,
      sandboxOnly: true,
      message: enabled
        ? 'Sandbox cancellation approval is enabled.'
        : 'Cashfree cancellation approval is disabled.'
    });
  }
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

router.get(
  '/orders/:id/invoice',
  require('../controllers/invoiceController').adminInvoice
);

router.post(
  '/orders/:id/refresh-payment',
  adminController.refreshPaymentDetails
);

router.patch(
  '/products/:id/visibility',
  require('../controllers/adminNoteController').setProductVisibility
);

router.put(
  '/orders/:id/note',
  require('../controllers/adminNoteController').saveNote
);

router.put(
  '/orders/:id',
  adminController.updateOrder
);


/* =====================================
   CASHFREE VERIFY PAYMENT
===================================== */

router.get(
  '/orders/:id/cashfree/verify',
  cashfreeReviewController
    .verifyCancellationPayment
);


/* =====================================
   SANDBOX APPROVAL SECURITY
===================================== */

function requireSandboxApproval(
  req,
  res,
  next
) {

  if (!isSandboxApprovalEnabled()) {

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
   SHIPROCKET SAFE MODE
===================================== */

function isLiveShipmentEnabled() {

  return (
    String(
      process.env
        .SHIPROCKET_LIVE_SHIPMENTS_ENABLED ||
      ''
    ).trim() === 'true'
  );
}


/*
  This middleware runs BEFORE the
  real shipment creation controller.

  When Safe Mode is ON, no call to
  createShiprocketOrder or
  assignCourierAwb can be made
  through this route.
*/

function requireLiveShipmentEnabled(
  req,
  res,
  next
) {

  res.set('Cache-Control', 'no-store');

  if (!isLiveShipmentEnabled()) {

    return res.status(403).json({
      success: false,
      safeMode: true,
      liveShipmentEnabled: false,
      shipmentCreated: false,
      message:
        'SHIPROCKET SAFE MODE IS ON. ' +
        'Real shipment creation is disabled. ' +
        'Use Test Shipment (Dry Run).'
    });
  }

  return next();
}


/* =====================================
   SHIPROCKET SAFE MODE STATUS

   GET:
   /api/admin/shiprocket/safe-mode

   READ ONLY
===================================== */

router.get(
  '/shiprocket/safe-mode',
  (req, res) => {

    res.set('Cache-Control', 'no-store');

    const liveEnabled =
      isLiveShipmentEnabled();

    return res.status(200).json({
      success: true,
      safeMode: !liveEnabled,
      liveShipmentEnabled: liveEnabled,
      dryRunEnabled: true,
      message: liveEnabled
        ? 'Live shipment creation is enabled.'
        : 'Safe Mode is ON. Real shipment creation is blocked.'
    });
  }
);


/* =====================================
   SHIPROCKET COURIER RATES

   Safe Mode does not block
   read-only courier checks.
===================================== */

router.post(
  '/orders/:id/check-couriers',
  shiprocketController.checkCourierRates
);


/* =====================================
   REAL SHIPMENT CREATION

   Important:
   The security middleware must
   remain BEFORE createShipment.
===================================== */

router.post(
  '/orders/:id/create-shipment',
  requireLiveShipmentEnabled,
  shiprocketController.createShipment
);


/* =====================================
   EXISTING SHIPMENT STATUS
===================================== */

router.get(
  '/orders/:id/shipment-status',
  shiprocketController.getShipmentStatus
);


/* =====================================
   SHIPROCKET DRY RUN

   Safe Mode ON or OFF:
   This endpoint never creates
   a real shipment or AWB.
===================================== */

router.post(
  '/orders/:id/shipment-dry-run',
  shiprocketDryRunController.dryRunShipment
);


/* =====================================
   ABANDONED CARTS (READ-ONLY)
===================================== */

router.get(
  '/abandoned-carts',
  abandonedCartController.listAbandonedCarts
);

router.get(
  '/cod-remittance',
  codRemittanceController.listCodRemittance
);

router.get('/banners', require('../controllers/bannerController').listBanners);
router.post('/banners', require('../controllers/bannerController').createBanner);
router.put('/banners/:id', require('../controllers/bannerController').updateBanner);
router.delete('/banners/:id', require('../controllers/bannerController').deleteBanner);

router.get(
  '/settings',
  require('../controllers/adminSettingsController').getSettings
);

router.put(
  '/settings',
  require('../controllers/adminSettingsController').updateSettings
);

router.get(
  '/payments',
  require('../controllers/adminPaymentController').listPayments
);

router.post(
  '/payments/:id/verify',
  require('../controllers/adminPaymentController').verifyPayment
);

router.post(
  '/payments/:id/refund',
  require('../controllers/adminPaymentController').refundPayment
);

router.get(
  '/cancel-followups',
  require('../controllers/adminAlertsController').listCancelFollowUps
);

router.post(
  '/cancel-followups/:id/done',
  require('../controllers/adminAlertsController').resolveCancelFollowUp
);

router.get(
  '/test-orders',
  require('../controllers/adminCleanupController').preview
);

router.post(
  '/test-orders/delete',
  require('../controllers/adminCleanupController').cleanup
);

router.get('/2fa/status', require('../controllers/adminTwoFactorController').status);
router.post('/2fa/setup', require('../controllers/adminTwoFactorController').setup);
router.post('/2fa/enable', require('../controllers/adminTwoFactorController').enable);
router.post('/2fa/disable', require('../controllers/adminTwoFactorController').disable);

router.get(
  '/launch-check',
  require('../controllers/adminLaunchCheckController').check
);

router.get(
  '/reports',
  require('../controllers/adminReportsController').report
);

router.get(
  '/today',
  require('../controllers/adminTodayController').today
);

router.get(
  '/pending-counts',
  require('../controllers/adminAlertsController').pendingCounts
);

router.get(
  '/return-requests',
  returnRequestController.listReturnRequests
);

router.patch(
  '/return-requests/:id',
  returnRequestController.updateReturnRequest
);

router.get(
  '/return-parcels',
  returnParcelController.listReturnParcels
);


/* =====================================
   USERS
===================================== */

router.get('/orders/:id/risk', require('../utils/http').asyncHandler(async (req, res) => {
  if (!require('mongoose').isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid order ID.' });
  const risk = await require('../services/codRisk').riskForOrder(req.params.id, require('../models'));
  if (!risk) return res.status(404).json({ success: false, message: 'Order not found.' });
  return res.json({ success: true, risk });
}));

router.get('/backup/download', require('../utils/http').asyncHandler(async (req, res) => {
  const backup = await require('../services/backupService').buildBackup();
  res.set({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': `attachment; filename="memora-backup-${backup.generatedAt.slice(0, 10)}.json"`,
    'Cache-Control': 'private, no-store'
  });
  return res.send(backup.json);
}));

const saleController = require('../controllers/adminSaleController');

router.get('/sale', saleController.summary);
router.post('/sale', saleController.create);
router.delete('/sale', saleController.stop);

router.get('/customers/summary', require('../controllers/adminCustomersController').summary);
router.get('/customers/export', require('../controllers/adminCustomersController').exportCsv);

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
