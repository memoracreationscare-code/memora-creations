'use strict';

/*
=========================================
 MEMORA CREATIONS
 RETURN / REPLACEMENT REQUESTS

 Customer: POST /api/orders/:id/return-request
 Admin:    GET  /api/admin/return-requests
           PATCH /api/admin/return-requests/:id

 A request does NOT refund money or change
 the order status. The owner decides, and
 refunds by hand from Cashfree (online) or
 by agreement (COD).
=========================================
*/

const mongoose = require('mongoose');
const { Order } = require('../models');
const { asyncHandler, error, ok } = require('../utils/http');
const { checkEligibility, windowDays } = require('../utils/returnRequests');

const TYPES = ['RETURN', 'REPLACEMENT'];
const ADMIN_STATUSES = ['APPROVED', 'REJECTED', 'COMPLETED'];

const requestReturn = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (!userId) throw error(401, 'Please login to continue.');

  if (!mongoose.isValidObjectId(req.params.id)) {
    throw error(400, 'Invalid order ID.');
  }

  const body = req.body || {};
  const type = String(body.type || '').toUpperCase();
  const reason = String(body.reason || '').trim().slice(0, 120);
  const details = String(body.details || '').trim().slice(0, 1000);

  if (!TYPES.includes(type)) throw error(400, 'Please choose Return or Replacement.');
  if (!reason) throw error(400, 'Please select a reason.');
  if (details.length < 5) throw error(400, 'Please describe the problem in a few words.');

  const order = await Order.findOne({ _id: req.params.id, user: userId });

  if (!order) throw error(404, 'Order not found.');

  const check = checkEligibility(order);

  if (!check.ok) throw error(400, check.message);

  // The filter makes a double click / second tab harmless.
  const saved = await Order.findOneAndUpdate(
    {
      _id: order._id,
      user: userId,
      'returnRequest.status': { $exists: false }
    },
    {
      $set: {
        returnRequest: {
          type,
          status: 'REQUESTED',
          reason,
          details,
          requestedAt: new Date()
        }
      }
    },
    { new: true }
  );

  if (!saved) throw error(400, 'A return request already exists for this order.');

  return ok(res, {
    message: 'Request sent. We will review it and contact you.',
    returnRequest: saved.returnRequest
  });
});

const listReturnRequests = asyncHandler(async (_req, res) => {
  const orders = await Order.find({ 'returnRequest.status': { $exists: true } })
    .sort({ 'returnRequest.requestedAt': -1 })
    .limit(300)
    .populate('user', 'name email mobile')
    .lean();

  const requests = orders.map(o => ({
    id: String(o._id),
    orderId: o.orderId || '',
    type: o.returnRequest.type,
    status: o.returnRequest.status,
    reason: o.returnRequest.reason || '',
    details: o.returnRequest.details || '',
    requestedAt: o.returnRequest.requestedAt || null,
    adminNote: o.returnRequest.adminNote || '',
    resolvedAt: o.returnRequest.resolvedAt || null,
    amount: Number(o.grandTotal || 0),
    paymentMethod: o.paymentMethod || '',
    paymentStatus: o.paymentStatus || '',
    fullName: o.shippingAddress?.fullName || o.user?.name || '',
    mobile: o.shippingAddress?.mobile || o.user?.mobile || '',
    email: o.user?.email || '',
    items: (o.items || []).map(i => ({
      name: i.name || i.productName || '',
      quantity: i.quantity || 1
    }))
  }));

  return ok(res, { requests, windowDays: windowDays() });
});

const updateReturnRequest = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw error(400, 'Invalid order ID.');
  }

  const status = String(req.body?.status || '').toUpperCase();
  const adminNote = String(req.body?.adminNote || '').trim().slice(0, 500);

  if (!ADMIN_STATUSES.includes(status)) throw error(400, 'Invalid status.');

  const order = await Order.findOneAndUpdate(
    { _id: req.params.id, 'returnRequest.status': { $exists: true } },
    {
      $set: {
        'returnRequest.status': status,
        'returnRequest.adminNote': adminNote,
        'returnRequest.resolvedAt': new Date()
      }
    },
    { new: true }
  );

  if (!order) throw error(404, 'Return request not found.');

  return ok(res, { returnRequest: order.returnRequest });
});

module.exports = { requestReturn, listReturnRequests, updateReturnRequest };
