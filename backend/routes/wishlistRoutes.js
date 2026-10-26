
const router = require('express').Router();

const mongoose = require('mongoose');

const {
  Wishlist,
  Product
} = require('../models');

const {
  requireUser
} = require('../middleware/auth');

const {
  asyncHandler,
  error,
  ok
} = require('../utils/http');

// All wishlist operations require customer login.
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
        select: 'name slug productId images originalPrice sellingPrice stock discountPercent isActive'
      })
      .lean();

    return ok(res, {
      products: wishlist?.products || []
    });
  })
);

// POST /api/wishlist
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

    const wishlist = await Wishlist.findOneAndUpdate(
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

// DELETE /api/wishlist/:productId
router.delete(
  '/:productId',
  asyncHandler(async (req, res) => {
    const productId = String(
      req.params.productId || ''
    );

    if (!mongoose.isValidObjectId(productId)) {
      throw error(400, 'Invalid product ID.');
    }

    const wishlist = await Wishlist.findOneAndUpdate(
      { user: req.user._id },
      {
        $pull: {
          products: new mongoose.Types.ObjectId(productId)
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
