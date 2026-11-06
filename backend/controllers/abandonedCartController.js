'use strict';

/*
=========================================
 MEMORA CREATIONS
 ADMIN: ABANDONED CARTS

 Read-only. Lists customers who left
 products in their cart so the owner can
 send a WhatsApp reminder by hand from
 the admin page. Nothing is sent from
 the server.
=========================================
*/

const { Cart, Order } = require('../models');

const {
  asyncHandler,
  ok
} = require('../utils/http');

const {
  buildAbandonedCarts,
  clampMinHours,
  MAX_DAYS
} = require('../utils/abandonedCarts');

const MAX_CARTS = 300;

const listAbandonedCarts = asyncHandler(async (req, res) => {

  const minHours = clampMinHours(req.query.hours);
  const now = new Date();

  const newest = new Date(now.getTime() - minHours * 60 * 60 * 1000);
  const oldest = new Date(now.getTime() - MAX_DAYS * 24 * 60 * 60 * 1000);

  const carts = await Cart.find({
    'items.0': { $exists: true },
    updatedAt: { $lte: newest, $gte: oldest }
  })
    .sort({ updatedAt: -1 })
    .limit(MAX_CARTS)
    .populate({
      path: 'user',
      select: 'fullName mobile isActive'
    })
    .populate({
      path: 'items.product',
      select: 'name sellingPrice stock isActive'
    })
    .lean();

  const userIds = carts
    .map(cart => cart.user?._id)
    .filter(Boolean);

  const latestOrders = userIds.length
    ? await Order.aggregate([
        { $match: { user: { $in: userIds } } },
        { $group: { _id: '$user', last: { $max: '$createdAt' } } }
      ])
    : [];

  const latestOrderByUser = new Map(
    latestOrders.map(row => [String(row._id), row.last])
  );

  const abandonedCarts = buildAbandonedCarts({
    carts,
    latestOrderByUser,
    minHours,
    now
  });

  return ok(res, {
    minHours,
    count: abandonedCarts.length,
    abandonedCarts
  });

});

module.exports = {
  listAbandonedCarts
};
