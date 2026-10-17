
/*
=========================================
 MEMORA CREATIONS
 CUSTOMER ORDER ROUTES

 FULL REPLACEMENT CODE

 ORDER PREVIEW
 COD ORDER CREATION
 MY ORDERS
 ORDER DETAILS
 COD ORDER CANCELLATION
 CASHFREE CANCELLATION REQUEST
=========================================
*/

const router = require('express').Router();

const orderController =
  require('../controllers/orderController');

const cancellationRequestController =
  require('../controllers/cancellationRequestController');

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

   Only records customer's request.

   Does not cancel order.
   Does not initiate refund.
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
   GET SINGLE ORDER DETAILS
===================================== */

router.get(
  '/:id',
  orderController.getOrder
);


/* =====================================
   EXPORT ROUTER
===================================== */

module.exports = router;
