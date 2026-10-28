
const router = require('express').Router();
const mongoose = require('mongoose');

const {
  Wishlist,
  Product,
  WishlistSettings
} = require('../models');

const {
  requireUser,
  requireAdmin
} = require('../middleware/auth');

const {
  asyncHandler,
  error,
  ok
} = require('../utils/http');

// ================================
// WISHLIST CONFIGURATION
// ================================

async function getWishlistSettings() {
  const settings = await WishlistSettings
    .findOne({ key: 'wishlist' })
    .lean();

  return {
    enabled: settings
      ? settings.enabled === true
      : true,
    updatedAt: settings?.updatedAt || null
  };
}

// PUBLIC CONFIGURATION
// GET /api/wishlist/config

router.get(
  '/config',
  asyncHandler(async (req, res) => {
    return ok(res, await getWishlistSettings());
  })
);

// ================================
// ADMIN WISHLIST SETTINGS
// ================================

// GET /api/wishlist/admin/settings

router.get(
  '/admin/settings',
  requireAdmin,
  asyncHandler(async (req, res) => {
    return ok(res, {
      settings: await getWishlistSettings()
    });
  })
);

// PUT /api/wishlist/admin/settings
// BODY: { "enabled": true }

router.put(
  '/admin/settings',
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (typeof req.body?.enabled !== 'boolean') {
      throw error(
        400,
        'enabled must be true or false.'
      );
    }

    const settings =
      await WishlistSettings.findOneAndUpdate(
        { key: 'wishlist' },
        {
          $set: {
            enabled: req.body.enabled,
            updatedBy: req.admin._id
          },
          $setOnInsert: {
            key: 'wishlist'
          }
        },
        {
          new: true,
          upsert: true,
          runValidators: true
        }
      );

    return ok(res, {
      message: settings.enabled
        ? 'Wishlist enabled successfully.'
        : 'Wishlist disabled successfully.',
      settings: {
        enabled: settings.enabled,
        updatedAt: settings.updatedAt
      }
    });
  })
);

// ================================
// ADMIN WISHLIST REPORT
// ================================

// GET /api/wishlist/admin/report

router.get(
  '/admin/report',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const [summary] = await Wishlist.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          totalSaves: {
            $sum: { $size: '$products' }
          }
        }
      }
    ]);

    const popular = await Wishlist.aggregate([
      { $unwind: '$products' },
      {
        $group: {
          _id: '$products',
          saves: { $sum: 1 }
        }
      },
      { $sort: { saves: -1 } },
      { $limit: 20 },
      {
        $lookup: {
          from: Product.collection.name,
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          _id: 0,
          productId: '$_id',
          name: '$product.name',
          slug: '$product.slug',
          sellingPrice: '$product.sellingPrice',
          stock: '$product.stock',
          isActive: '$product.isActive',
          image: {
            $arrayElemAt: [
              '$product.images.url',
              0
            ]
          },
          saves: 1
        }
      }
    ]);

    return ok(res, {
      settings: await getWishlistSettings(),
      summary: {
        totalUsers: summary?.totalUsers || 0,
        totalSaves: summary?.totalSaves || 0
      },
      popularProducts: popular
    });
  })
);

// ================================
// CUSTOMER AUTHENTICATION
// ================================

router.use(requireUser);

// GET /api/wishlist

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const wishlist = await Wishlist.findOne({
      user: req.user._id
    })
      .populate({
        path: 'products',
        match: { isActive: true },
        select:
          'name slug productId images originalPrice sellingPrice stock discountPercent isActive'
      })
      .lean();

    const settings = await getWishlistSettings();

    return ok(res, {
      products: wishlist?.products || [],
      enabled: settings.enabled
    });
  })
);

// ================================
// BLOCK CUSTOMER MODIFICATIONS
// WHEN WISHLIST IS DISABLED
// ================================

router.use(
  asyncHandler(async (req, res, next) => {
    const settings = await getWishlistSettings();

    if (!settings.enabled) {
      throw error(
        403,
        'Wishlist is temporarily disabled by Admin.'
      );
    }

    next();
  })
);

// ================================
// ADD TO WISHLIST
// POST /api/wishlist
// ================================

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const productId = String(
      req.body?.productId || ''
    );

    if (!mongoose.isValidObjectId(productId)) {
      throw error(400, 'Invalid product ID.');
    }

    const product = await Product.findOne({
      _id: productId,
      isActive: true
    }).select('_id');

    if (!product) {
      throw error(404, 'Product not found.');
    }

    const wishlist =
      await Wishlist.findOneAndUpdate(
        { user: req.user._id },
        {
          $addToSet: {
            products: product._id
          }
        },
        {
          new: true,
          upsert: true,
          runValidators: true
        }
      );

    return ok(res, {
      message: 'Product added to wishlist.',
      count: wishlist.products.length
    });
  })
);

// ================================
// REMOVE FROM WISHLIST
// DELETE /api/wishlist/:productId
// ================================

router.delete(
  '/:productId',
  asyncHandler(async (req, res) => {
    const productId = String(
      req.params.productId || ''
    );

    if (!mongoose.isValidObjectId(productId)) {
      throw error(400, 'Invalid product ID.');
    }

    const wishlist =
      await Wishlist.findOneAndUpdate(
        { user: req.user._id },
        {
          $pull: {
            products: new mongoose.Types.ObjectId(
              productId
            )
          }
        },
        { new: true }
      );

    return ok(res, {
      message: 'Product removed from wishlist.',
      count: wishlist?.products?.length || 0
    });
  })
);

module.exports = router;
