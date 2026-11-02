
/*
=========================================
 MEMORA CREATIONS
 PRODUCT REVIEWS & RATINGS ROUTES

 VERIFIED PURCHASE
 PHOTO UPLOAD
 ADMIN MODERATION
 ADMIN REVIEW HISTORY
=========================================
*/

const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const router = express.Router();

const {
  Product,
  Order,
  Review
} = require('../models');

const reviewController = require(
  '../controllers/reviewController'
);

const {
  requireUser,
  requireAdmin
} = require('../middleware/auth');


/*
=========================================
 CLOUDINARY CONFIGURATION
=========================================
*/

function configureCloudinary() {

  const cloudName =
    process.env.CLOUDINARY_CLOUD_NAME;

  const apiKey =
    process.env.CLOUDINARY_API_KEY;

  const apiSecret =
    process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return false;
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  });

  return true;
}


/*
=========================================
 IMAGE UPLOAD CONFIGURATION

 Maximum image size: 5 MB
 JPEG, PNG and WebP only
=========================================
*/

const upload = multer({

  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  },

  fileFilter: (_req, file, callback) => {

    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    if (!allowed.includes(file.mimetype)) {

      const err = new Error(
        'Only JPG, PNG and WebP photos allowed.'
      );

      err.statusCode = 400;

      return callback(err);
    }

    callback(null, true);
  }

});


/*
=========================================
 VERIFY IMAGE FILE CONTENT
=========================================
*/

function detectImageType(buffer) {

  if (!Buffer.isBuffer(buffer)) {
    return null;
  }

  if (
    buffer.length >= 3 &&
    buffer[0] === 0xFF &&
    buffer[1] === 0xD8 &&
    buffer[2] === 0xFF
  ) {
    return 'jpg';
  }

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([
        137, 80, 78, 71,
        13, 10, 26, 10
      ])
    )
  ) {
    return 'png';
  }

  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }

  return null;
}


/*
=========================================
 VERIFY PRODUCT PURCHASE
=========================================
*/

async function verifyReviewPurchase(
  userId,
  productId
) {

  const product = await Product.findById(
    productId
  ).select('_id isActive');

  if (!product || !product.isActive) {
    return {
      eligible: false,
      message: 'Product not available.'
    };
  }

  const existing = await Review.exists({
    product: product._id,
    user: userId
  });

  if (existing) {
    return {
      eligible: false,
      message:
        'You already reviewed this product.'
    };
  }

  const order = await Order.findOne({

    user: userId,

    orderStatus: 'Delivered',

    'items.product': product._id,

    $or: [
      {
        paymentMethod: {
          $in: [
            'CASHFREE',
            'RAZORPAY'
          ]
        },
        paymentStatus: 'SUCCESS'
      },

      {
        paymentMethod: 'COD',
        paymentStatus: 'SUCCESS'
      }
    ]

  })
    .select('_id')
    .lean();

  if (!order) {
    return {
      eligible: false,
      message:
        'Only delivered and paid purchases can be reviewed.'
    };
  }

  return {
    eligible: true,
    order
  };
}


/*
=========================================
 CLOUDINARY IMAGE UPLOAD
=========================================
*/

function uploadToCloudinary(buffer) {

  return new Promise((resolve, reject) => {

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'memora-creations/reviews',
        resource_type: 'image',
        overwrite: false,
        transformation: [
          {
            width: 1600,
            height: 1600,
            crop: 'limit',
            quality: 'auto',
            fetch_format: 'auto'
          }
        ]
      },

      (err, result) => {

        if (err) {
          return reject(err);
        }

        if (!result?.secure_url) {
          return reject(
            new Error('Image upload failed.')
          );
        }

        resolve(result.secure_url);

      }
    );

    stream.end(buffer);

  });
}


/*
=========================================
 UPLOAD REVIEW PHOTO

 POST /api/reviews/product/:productId/photo
=========================================
*/

router.post(
  '/product/:productId/photo',
  requireUser,
  upload.single('photo'),
  async (req, res, next) => {

    try {

      const productId =
        String(req.params.productId || '');

      if (
        !mongoose.isValidObjectId(productId)
      ) {

        return res.status(400).json({
          success: false,
          message: 'Invalid product ID.'
        });

      }

      if (!req.file?.buffer) {

        return res.status(400).json({
          success: false,
          message: 'Please select a photo.'
        });

      }

      const detectedType =
        detectImageType(req.file.buffer);

      const mimeMap = {
        jpg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp'
      };

      if (
        !detectedType ||
        mimeMap[detectedType] !==
          req.file.mimetype
      ) {

        return res.status(400).json({
          success: false,
          message:
            'Invalid image content or file type.'
        });

      }

      const purchase =
        await verifyReviewPurchase(
          req.user._id,
          productId
        );

      if (!purchase.eligible) {

        return res.status(403).json({
          success: false,
          message: purchase.message
        });

      }

      if (!configureCloudinary()) {

        return res.status(503).json({
          success: false,
          message:
            'Photo upload is not configured.'
        });

      }

      const url = await uploadToCloudinary(
        req.file.buffer
      );

      return res.status(201).json({
        success: true,
        message:
          'Review photo uploaded successfully.',
        url
      });

    } catch (err) {

      console.error(
        'Review photo upload failed:',
        err.message
      );

      return next(err);
    }
  }
);


/*
=========================================
 PUBLIC PRODUCT REVIEWS
=========================================
*/

router.get(
  '/product/:productId',
  reviewController.listProductReviews
);


/*
=========================================
 CUSTOMER REVIEW ELIGIBILITY
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

 EXISTING ENDPOINT PRESERVED
=========================================
*/

router.get(
  '/admin/pending',
  requireAdmin,
  reviewController.listPendingReviews
);


/*
=========================================
 NEW: ADMIN REVIEW HISTORY

 GET /api/reviews/admin/history

 Optional:
 ?status=APPROVED
 ?status=REJECTED
 ?status=PENDING

 Pagination:
 ?page=1
 ?limit=20

 ADMIN ONLY
 READ-ONLY
 NO REVIEWS ARE DELETED OR MODIFIED
=========================================
*/

router.get(
  '/admin/history',
  requireAdmin,
  async (req, res, next) => {

    try {

      const status = String(
        req.query.status || 'ALL'
      ).trim().toUpperCase();

      const allowedStatuses = [
        'ALL',
        'PENDING',
        'APPROVED',
        'REJECTED'
      ];

      if (!allowedStatuses.includes(status)) {

        return res.status(400).json({
          success: false,
          message: 'Invalid review status.'
        });
      }

      const parsedPage = Number(
        req.query.page || 1
      );

      const parsedLimit = Number(
        req.query.limit || 20
      );

      if (
        !Number.isInteger(parsedPage) ||
        parsedPage < 1 ||
        !Number.isInteger(parsedLimit) ||
        parsedLimit < 1
      ) {

        return res.status(400).json({
          success: false,
          message: 'Invalid pagination values.'
        });
      }

      const page = Math.min(
        parsedPage,
        100000
      );

      const limit = Math.min(
        parsedLimit,
        50
      );

      const filter =
        status === 'ALL'
          ? {}
          : { status };

      const [
        reviews,
        total,
        pendingCount,
        approvedCount,
        rejectedCount
      ] = await Promise.all([

        Review.find(filter)
          .populate(
            'product',
            'name productId slug'
          )
          .populate(
            'user',
            'fullName'
          )
          .populate(
            'order',
            'orderId'
          )
          .sort({
            updatedAt: -1,
            _id: -1
          })
          .skip(
            (page - 1) * limit
          )
          .limit(limit)
          .lean(),

        Review.countDocuments(filter),

        Review.countDocuments({
          status: 'PENDING'
        }),

        Review.countDocuments({
          status: 'APPROVED'
        }),

        Review.countDocuments({
          status: 'REJECTED'
        })

      ]);

      return res.status(200).json({

        success: true,

        reviews,

        summary: {
          totalReviews:
            pendingCount +
            approvedCount +
            rejectedCount,

          pending: pendingCount,
          approved: approvedCount,
          rejected: rejectedCount
        },

        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(
            total / limit
          )
        },

        filter: status

      });

    } catch (err) {

      return next(err);
    }
  }
);


/*
=========================================
 ADMIN APPROVE / REJECT REVIEW

 EXISTING ENDPOINT PRESERVED
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
