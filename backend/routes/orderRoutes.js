
/*
=========================================
 MEMORA CREATIONS
 CUSTOMER ORDER ROUTES

 ORDER PREVIEW
 COD ORDER CREATION
 MY ORDERS
 ORDER DETAILS
 SHIPMENT TRACKING
 COD ORDER CANCELLATION
 CASHFREE CANCELLATION REQUEST

 Customer authentication required.
=========================================
*/

const router = require('express').Router();

const orderController =
  require('../controllers/orderController');

const cancellationRequestController =
  require('../controllers/cancellationRequestController');

const shipmentTrackingController =
  require('../controllers/shipmentTrackingController');

const {
  requireUser
} = require('../middleware/auth');


/* =====================================
   CUSTOMER LOGIN REQUIRED
===================================== */

router.use(requireUser);


/* =====================================
   ORDER PREVIEW
===================================== */

router.post(
  '/preview',
  orderController.preview
);


/* =====================================
   CREATE COD ORDER
===================================== */

router.post(
  '/cod',
  orderController.createCod
);


/* =====================================
   MY ORDERS
===================================== */

router.get(
  '/',
  orderController.listOrders
);


/* =====================================
   CASHFREE CANCELLATION REQUEST

   POST:
   /api/orders/:id/cancel-request

   Does not cancel the order.
   Does not initiate a refund.
   Does not release stock.
===================================== */

router.post(
  '/:id/cancel-request',
  cancellationRequestController.requestCancellation
);


/* =====================================
   CANCEL COD ORDER

   PATCH:
   /api/orders/:id/cancel
===================================== */

router.patch(
  '/:id/cancel',
  orderController.cancelOrder
);


/* =====================================
   CUSTOMER SHIPMENT TRACKING

   GET:
   /api/orders/:id/shipment-tracking

   Only the logged-in order owner
   can view their shipment.

   Read-only.
   No order or payment changes.
===================================== */

router.get(
  '/:id/shipment-tracking',
  shipmentTrackingController.getShipmentTracking
);


/* =====================================
   GET SINGLE ORDER DETAILS

   Keep after shipment-specific routes.
===================================== */

router.get(
  '/:id',
  orderController.getOrder
);


/* =====================================
   EXPORT ROUTER
===================================== */

module.exports = router;
