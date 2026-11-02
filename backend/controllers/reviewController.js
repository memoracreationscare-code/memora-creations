
/*
==========================================
 MEMORA CREATIONS
 PRODUCT REVIEWS & RATINGS CONTROLLER
==========================================
*/

const mongoose = require('mongoose');

const {
  Product,
  Order,
  Review
} = require('../models');

const {
  asyncHandler,
  error,
  ok
} = require('../utils/http');

const MAX_PHOTOS = 3;
const MAX_COMMENT = 1500;
const MAX_TITLE = 120;

/*
==========================================
 HELPERS
==========================================
*/

function validId(id) {
  if (!mongoose.isValidObjectId(id)) {
    throw error(400, 'Invalid ID.');
  }

  return id;
}

function clean(value, max) {
  return String(value || '')
    .trim()
    .slice(0, max);
}

function normalizePhotos(photos) {
  if (photos === undefined || photos === null) {
    return [];
  }

  if (!Array.isArray(photos) ||
      photos.length > MAX_PHOTOS) {
    throw error(400, 'Maximum 3 photos allowed.');
  }

  const cloudName =
    process.env.CLOUDINARY_CLOUD_NAME;

  if (!cloudName && photos.length) {
    throw error(
      503,
      'Review photo storage is not configured.'
    );
  }

  return photos.map(photo => {
    if (typeof photo !== 'string' ||
        photo.length > 500) {
      throw error(400, 'Invalid review photo.');
    }

    let url;

    try {
      url = new URL(photo);
    } catch {
      throw error(400, 'Invalid photo URL.');
    }

    const expectedPrefix =
      '/' + cloudName + '/image/upload/';

    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'res.cloudinary.com' ||
      !url.pathname.startsWith(expectedPrefix) ||
      url.search ||
      url.hash
    ) {
      throw error(
        400,
        'Only configured Cloudinary images allowed.'
      );
    }

    return url.toString();
  });
}

async function findProduct(key) {
  const value = String(key || '');

  const conditions = [
    { productId: value },
    { slug: value }
  ];

  if (mongoose.isValidObjectId(value)) {
    conditions.unshift({ _id: value });
  }

  const product = await Product.findOne({
    isActive: true,
    $or: conditions
  });

  if (!product) {
    throw error(404, 'Product not found.');
  }

  return product;
}

/*
==========================================
 VERIFIED PURCHASE

 Review allowed only when:
 - Customer owns the order
 - Product exists in order
 - Order was delivered
 - Online payment is SUCCESS
   OR COD has been marked paid
==========================================
*/

async function findEligibleOrder(userId, productId) {
  return Order.findOne({
    user: userId,

    orderStatus: 'Delivered',

    'items.product': productId,

    $or: [
      {
        paymentMethod: {
          $in: ['CASHFREE', 'RAZORPAY']
        },
        paymentStatus: 'SUCCESS'
      },
      {
        paymentMethod: 'COD',
        paymentStatus: 'SUCCESS'
      }
    ]
  })
    .sort({ createdAt: -1 })
    .select('_id orderId')
    .lean();
}

/*
==========================================
 PUBLIC PRODUCT REVIEWS
 GET /api/reviews/product/:productId
==========================================
*/

const listProductReviews = asyncHandler(
  async (req, res) => {
    const product = await findProduct(
      req.params.productId
    );

    const page = Math.max(
      1,
      Math.floor(Number(req.query.page) || 1)
    );

    const limit = 10;

    const filter = {
      product: product._id,
      status: 'APPROVED'
    };

    const [reviews, total, summary] =
      await Promise.all([
        Review.find(filter)
          .select(
            'rating title comment photos ' +
            'verifiedPurchase createdAt user'
          )
          .populate('user', 'fullName')
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),

        Review.countDocuments(filter),

        Review.aggregate([
          {
            $match: filter
          },
          {
            $group: {
              _id: null,
              averageRating: {
                $avg: '$rating'
              },
              totalRatings: {
                $sum: 1
              }
            }
          }
        ])
      ]);

    return ok(res, {
      reviews: reviews.map(review => ({
        _id: review._id,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        photos: review.photos,
        verifiedPurchase:
          review.verifiedPurchase,
        createdAt: review.createdAt,
        customerName:
          review.user?.fullName || 'Customer'
      })),

      summary: {
        averageRating: Number(
          (summary[0]?.averageRating || 0)
            .toFixed(1)
        ),
        totalRatings:
          summary[0]?.totalRatings || 0
      },

      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  }
);

/*
==========================================
 CUSTOMER REVIEW ELIGIBILITY
 GET /api/reviews/product/:productId/eligibility
==========================================
*/

const checkEligibility = asyncHandler(
  async (req, res) => {
    const product = await findProduct(
      req.params.productId
    );

    const existing = await Review.findOne({
      product: product._id,
      user: req.user._id
    }).select('status rating');

    const eligibleOrder = await findEligibleOrder(
      req.user._id,
      product._id
    );

    return ok(res, {
      eligible: Boolean(
        eligibleOrder && !existing
      ),
      alreadyReviewed: Boolean(existing),
      reviewStatus: existing?.status || null,
      message: existing
        ? 'You already reviewed this product.'
        : eligibleOrder
          ? 'You can review this product.'
          : 'Review available after confirmed delivery and payment.'
    });
  }
);

/*
==========================================
 SUBMIT REVIEW
 POST /api/reviews/product/:productId
==========================================
*/

const createReview = asyncHandler(
  async (req, res) => {
    const product = await findProduct(
      req.params.productId
    );

    const rating = Number(req.body.rating);

    if (
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      throw error(
        400,
        'Rating must be from 1 to 5 stars.'
      );
    }

    const title = clean(
      req.body.title,
      MAX_TITLE
    );

    const comment = clean(
      req.body.comment,
      MAX_COMMENT
    );

    if (comment.length < 10) {
      throw error(
        400,
        'Review must contain at least 10 characters.'
      );
    }

    const photos = normalizePhotos(
      req.body.photos
    );

    const existing = await Review.findOne({
      user: req.user._id,
      product: product._id
    });

    if (existing) {
      throw error(
        409,
        'You already reviewed this product.'
      );
    }

    const order = await findEligibleOrder(
      req.user._id,
      product._id
    );

    if (!order) {
      throw error(
        403,
        'Only customers with delivered and paid orders can review this product.'
      );
    }

    try {
      const review = await Review.create({
        product: product._id,
        user: req.user._id,
        order: order._id,
        rating,
        title,
        comment,
        photos,
        verifiedPurchase: true,
        status: 'PENDING'
      });

      return ok(
        res,
        {
          message:
            'Review submitted for admin approval.',
          reviewId: review._id,
          status: review.status
        },
        201
      );

    } catch (err) {
      if (err.code === 11000) {
        throw error(
          409,
          'You already reviewed this product.'
        );
      }

      throw err;
    }
  }
);

/*
==========================================
 ADMIN PENDING REVIEWS
 GET /api/reviews/admin/pending
==========================================
*/

const listPendingReviews = asyncHandler(
  async (_req, res) => {
    const reviews = await Review.find({
      status: 'PENDING'
    })
      .populate('product', 'name productId')
      .populate('user', 'fullName')
      .sort({ createdAt: 1 })
      .limit(100)
      .lean();

    return ok(res, { reviews });
  }
);

/*
==========================================
 ADMIN APPROVE / REJECT
 PATCH /api/reviews/admin/:id/status
==========================================
*/

const updateReviewStatus = asyncHandler(
  async (req, res) => {
    validId(req.params.id);

    const status = String(
      req.body.status || ''
    ).toUpperCase();

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      throw error(
        400,
        'Status must be APPROVED or REJECTED.'
      );
    }

    const review = await Review.findOneAndUpdate(
      {
        _id: req.params.id,
        status: 'PENDING'
      },
      {
        $set: {
          status,
          approvedAt:
            status === 'APPROVED'
              ? new Date()
              : null
        }
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!review) {
      throw error(
        404,
        'Pending review not found.'
      );
    }

    return ok(res, {
      message:
        'Review status updated successfully.',
      review
    });
  }
);

/*
==========================================
 EXPORTS
==========================================
*/

module.exports = {
  listProductReviews,
  checkEligibility,
  createReview,
  listPendingReviews,
  updateReviewStatus
};
