
/*
=========================================
 MEMORA CREATIONS
 CUSTOMER ORDER ROUTES

 ORDER PREVIEW
 COD ORDER
 MY ORDERS
 ORDER DETAILS
 COD CANCELLATION
 CASHFREE CANCELLATION REQUEST
=========================================
*/

const router =
  require('express').Router();

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
   CASHFREE CANCEL REQUEST

   Only submits a request.

   Does NOT:
   - Cancel the order
   - Change payment status
   - Release stock
   - Initiate refund
===================================== */

router.post(
  '/:id/cancel-request',
  cancellationRequestController.requestCancellation
);


/* =====================================
   CUSTOMER CANCEL COD ORDER
===================================== */

router.patch(
  '/:id/cancel',
  orderController.cancelOrder
);


/* =====================================
   GET SINGLE ORDER DETAILS

   Keep this generic route after
   more specific order routes.
===================================== */

router.get(
  '/:id',
  orderController.getOrder
);


/* =====================================
   EXPORT ROUTER
===================================== */

module.exports = router;
