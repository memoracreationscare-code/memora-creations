'use strict';

/*
  GET /api/admin/pending-counts

  Small numbers for the admin panel badges and the "needs your
  attention" banner. Read-only.
*/

const { Order } = require('../models');
const { asyncHandler, ok, error } = require('../utils/http');

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

/*
  What counts as "new": only requests that arrived AFTER the admin last
  opened that page. Open the page and the red alert goes away; the next
  new request brings it back.
*/

// section the admin opens  ->  alert keys that are cleared by it
const SEEN_SECTIONS = {
  orders: ['orders'],
  cancellations: ['cancellations', 'cancelFollowUps'],
  returns: ['returns'],
  reviews: ['reviews'],
  lowStock: ['lowStock'],
  passwordResets: ['passwordResets']
};

const EPOCH = new Date(0);

async function seenTimes(adminId) {
  const times = {};

  if (!adminId) return times;

  const { AdminSeen } = require('../models');
  const rows = await AdminSeen.find({ admin: adminId }).lean();

  rows.forEach(r => { times[r.section] = r.seenAt; });

  return times;
}

const pendingCounts = asyncHandler(async (req, res) => {
  const { Product, Review, User } = require('../models');

  const seen = await seenTimes(req.admin && req.admin._id);
  const since = key => seen[key] || EPOCH;

  const [orders, cancellations, returns, cancelFollowUps, lowStock, reviews, passwordResets] = await Promise.all([
    Order.countDocuments({
      createdAt: { $gt: since('orders') },
      orderStatus: { $ne: 'Cancelled' },
      $or: [
        { paymentMethod: 'COD', paymentStatus: 'COD_PENDING' },
        { paymentStatus: 'SUCCESS' }
      ]
    }),
    Order.countDocuments({
      orderStatus: { $ne: 'Cancelled' },
      statusHistory: {
        $elemMatch: {
          note: { $regex: '^CUSTOMER_CASHFREE_CANCEL_REQUEST' },
          changedAt: { $gt: since('cancellations') }
        }
      }
    }),
    Order.countDocuments({
      'returnRequest.status': 'REQUESTED',
      'returnRequest.requestedAt': { $gt: since('returns') }
    }),
    Order.countDocuments({
      ...followUpFilter(),
      'autoCancel.at': { $gt: since('cancellations') }
    }),
    Product.countDocuments({
      isActive: true,
      stock: { $lte: 3 },
      updatedAt: { $gt: since('lowStock') }
    }),
    Review.countDocuments({ status: 'PENDING', createdAt: { $gt: since('reviews') } }),
    User.countDocuments({ passwordResetRequestedAt: { $gt: since('passwordResets') } })
  ]);

  // Staff only work on orders and returns; do not show them alerts for pages they cannot open.
  if (req.admin && req.admin.role === 'staff') {
    return ok(res, { orders, cancellations: 0, returns, cancelFollowUps: 0, lowStock: 0, reviews: 0, passwordResets: 0 });
  }

  return ok(res, { orders, cancellations, returns, cancelFollowUps, lowStock, reviews, passwordResets });
});

/* POST /api/admin/seen  { section } : "I have looked at this page". */
const markSeen = asyncHandler(async (req, res) => {
  const section = String((req.body && req.body.section) || '');

  if (!Object.prototype.hasOwnProperty.call(SEEN_SECTIONS, section)) {
    throw error(400, 'Unknown section.');
  }

  if (!req.admin || !req.admin._id) {
    throw error(401, 'Please login to continue.');
  }

  const { AdminSeen } = require('../models');

  await AdminSeen.updateOne(
    { admin: req.admin._id, section },
    { $set: { seenAt: new Date() } },
    { upsert: true }
  );

  return ok(res, { section, keys: SEEN_SECTIONS[section] });
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

module.exports = { SEEN_SECTIONS, pendingCounts, markSeen, listCancelFollowUps, resolveCancelFollowUp };
