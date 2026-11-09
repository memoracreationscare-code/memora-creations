'use strict';

/*
  GET /api/admin/pending-counts

  Small numbers for the admin panel badges and the "needs your
  attention" banner. Read-only.
*/

const { Order } = require('../models');
const { asyncHandler, ok } = require('../utils/http');

const FOLLOW_UP = {
  resolved: { $ne: true },
  $or: [
    { 'autoCancel.refundStatus': 'FAILED' },
    { 'autoCancel.shiprocket': 'FAILED' }
  ]
};

const followUpFilter = () => ({
  'autoCancel.resolved': { $ne: true },
  $or: FOLLOW_UP.$or
});

const pendingCounts = asyncHandler(async (_req, res) => {
  const { Product } = require('../models');

  const [cancellations, returns, cancelFollowUps, lowStock] = await Promise.all([
    Order.countDocuments({
      orderStatus: { $ne: 'Cancelled' },
      statusHistory: {
        $elemMatch: { note: { $regex: '^CUSTOMER_CASHFREE_CANCEL_REQUEST' } }
      }
    }),
    Order.countDocuments({ 'returnRequest.status': 'REQUESTED' }),
    Order.countDocuments(followUpFilter()),
    Product.countDocuments({ isActive: true, stock: { $lte: 3 } })
  ]);

  return ok(res, { cancellations, returns, cancelFollowUps, lowStock });
});

/* Orders cancelled automatically where a refund or Shiprocket step failed. */
const listCancelFollowUps = asyncHandler(async (_req, res) => {
  const orders = await Order.find(followUpFilter())
    .sort({ 'autoCancel.at': -1 })
    .limit(100)
    .lean();

  return ok(res, {
    orders: orders.map(o => ({
      id: String(o._id),
      orderId: o.orderId,
      amount: Number(o.grandTotal || 0),
      fullName: o.shippingAddress?.fullName || '',
      mobile: o.shippingAddress?.mobile || '',
      cashfreeOrderId: o.cashfreeOrderId || '',
      refundStatus: o.autoCancel?.refundStatus || '',
      refundAmount: o.autoCancel?.refundAmount || 0,
      shiprocket: o.autoCancel?.shiprocket || '',
      error: o.autoCancel?.error || '',
      at: o.autoCancel?.at || null
    }))
  });
});

const resolveCancelFollowUp = asyncHandler(async (req, res) => {
  await Order.updateOne(
    { _id: req.params.id },
    { $set: { 'autoCancel.resolved': true } }
  );

  return ok(res, { resolved: true });
});

module.exports = { pendingCounts, listCancelFollowUps, resolveCancelFollowUp };
