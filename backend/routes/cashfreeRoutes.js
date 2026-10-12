
/* =========================================
   MEMORA CREATIONS
   CASHFREE PAYMENT ROUTES
========================================= */

const router = require('express').Router();

const {
  requireUser
} = require('../middleware/auth');

const {
  createOrder,
  verifyPayment
} = require('../controllers/cashfreeController');


/* =========================================
   AUTHENTICATION

   Both routes require a logged-in user.
========================================= */

router.use(requireUser);


/* =========================================
   CREATE CASHFREE ORDER
========================================= */

router.post(
  '/create-order',
  createOrder
);


/* =========================================
   VERIFY CASHFREE PAYMENT
========================================= */

router.post(
  '/verify',
  verifyPayment
);


/* =========================================
   EXPORT ROUTER
========================================= */

module.exports = router;
