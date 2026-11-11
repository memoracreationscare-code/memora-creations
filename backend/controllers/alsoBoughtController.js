'use strict';

/*
  GET /api/products/:id/also-bought

  Products that other customers bought in the SAME order as this one
  (cancelled / unpaid orders ignored), most frequent first. Only active,
  in-stock products are returned. Returns an empty list when there is not
  enough order history yet, so the page can fall back to "You may also like".
*/

const MIN_ORDERS = 2;
const LIMIT = 4;

async function alsoBoughtFor(productId, models, serialize) {
  const { Order, Product } = models;

  const rows = await Order.aggregate([
    {
      $match: {
        'items.product': productId,
        orderStatus: { $ne: 'Cancelled' },
        $or: [{ paymentMethod: 'COD' }, { paymentStatus: 'SUCCESS' }]
      }
    },
    { $sort: { createdAt: -1 } },
    { $limit: 500 },
    { $unwind: '$items' },
    { $match: { 'items.product': { $ne: productId } } },
    { $group: { _id: '$items.product', orders: { $sum: 1 } } },
    { $match: { orders: { $gte: MIN_ORDERS } } },
    { $sort: { orders: -1 } },
    { $limit: LIMIT * 3 }
  ]);

  if (!rows.length) return [];

  const found = await Product.find({
    _id: { $in: rows.map(r => r._id) },
    isActive: true,
    stock: { $gt: 0 }
  }).populate('category', 'name slug').lean();

  const byId = new Map(found.map(p => [String(p._id), p]));

  return rows
    .map(r => byId.get(String(r._id)))
    .filter(Boolean)
    .slice(0, LIMIT)
    .map(serialize);
}

async function alsoBought(req, res, deps = {}) {
  const mongoose = deps.mongoose || require('mongoose');
  const id = String(req.params.id || '');

  if (!mongoose.isValidObjectId(id)) return res.json({ success: true, products: [] });

  const models = deps.models || require('../models');
  const serialize = deps.serialize || require('./productController').serialize;

  try {
    const products = await alsoBoughtFor(new mongoose.Types.ObjectId(id), models, serialize);
    return res.json({ success: true, products });
  } catch (err) {
    console.warn('[Also bought]', err.message);
    return res.json({ success: true, products: [] });
  }
}

module.exports = { alsoBought, alsoBoughtFor };
