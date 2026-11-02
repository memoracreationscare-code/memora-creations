
/*
=========================================
 MEMORA CREATIONS
 PRODUCT REVIEWS & RATINGS ROUTES
=========================================
*/

const express = require('express');

const router = express.Router();

const reviewController = require(
  '../controllers/reviewController'
);

const {
  requireUser,
  requireAdmin
} = require('../middleware/auth');


/*
=========================================
 PUBLIC PRODUCT REVIEWS

 Anyone can view approved reviews.
=========================================
*/

router.get(
  '/product/:productId',
  reviewController.listProductReviews
);


/*
=========================================
 CUSTOMER REVIEW ELIGIBILITY

 Customer login required.
=========================================
*/

router.get(
  '/product/:productId/eligibility',
  requireUser,
  reviewController.checkEligibility
);


/*
=========================================
 SUBMIT PRODUCT REVIEW

 Customer login required.
 Verified purchase checked by controller.
=========================================
*/

router.post(
  '/product/:productId',
  requireUser,
  reviewController.createReview
);


/*
=========================================
 ADMIN PENDING REVIEWS

 Admin login required.
=========================================
*/

router.get(
  '/admin/pending',
  requireAdmin,
  reviewController.listPendingReviews
);


/*
=========================================
 ADMIN APPROVE OR REJECT REVIEW

 Admin login required.
=========================================
*/

router.patch(
  '/admin/:id/status',
  requireAdmin,
  reviewController.updateReviewStatus
);


/*
=========================================
 EXPORT ROUTER
=========================================
*/

module.exports = router;
