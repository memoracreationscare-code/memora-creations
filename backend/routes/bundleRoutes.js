'use strict';

/*
  Public: GET /api/bundles?productId=<mongo id>
  Active bundle offers that include this product, with the other items,
  so the product page can show "Buy together and save".
*/

const router = require('express').Router();
const mongoose = require('mongoose');
const { asyncHandler, ok } = require('../utils/http');

const money = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

router.get('/', asyncHandler(async (req, res) => {
  const id = String(req.query.productId || '');
  if (!mongoose.Types.ObjectId.isValid(id)) return ok(res, { bundles: [] });

  const { Bundle } = require('../models');
  const rows = await Bundle.find({ isActive: true, products: id })
    .populate('products', 'name images sellingPrice isActive stock variants')
    .sort({ discountAmount: -1 })
    .limit(3)
    .lean();

  const bundles = rows
    .filter(b => b.products.every(p => p && p.isActive !== false))
    .map(b => {
      const items = b.products.map(p => ({
        _id: String(p._id),
        name: p.name,
        image: (p.images && p.images[0] && p.images[0].url) || '',
        price: Number(p.sellingPrice) || 0,
        inStock: (Number(p.stock) || 0) > 0 || (Array.isArray(p.variants) && p.variants.length > 0),
        // size / colour must be picked on the product's own page
        needsChoice: Array.isArray(p.variants) && p.variants.length > 0
      }));
      const total = money(items.reduce((s, i) => s + i.price, 0));
      const discount = Math.min(Number(b.discountAmount) || 0, total);
      return {
        id: String(b._id),
        name: b.name,
        items,
        total,
        discount: money(discount),
        payable: money(total - discount)
      };
    });

  res.set('Cache-Control', 'public, max-age=30');
  return ok(res, { bundles });
}));

module.exports = router;
