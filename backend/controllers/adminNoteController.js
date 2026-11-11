'use strict';

/*
  PUT /api/admin/orders/:id/note   { text }

  A private note on an order (for example "customer called, wants
  delivery after Sunday"). Only the admin panel shows it. An empty text
  removes the note.
*/

const mongoose = require('mongoose');
const { Order } = require('../models');
const { asyncHandler, error, ok } = require('../utils/http');

const saveNote = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw error(400, 'Invalid order.');

  const text = String(req.body?.text ?? '').trim().slice(0, 1000);

  const order = await Order.findByIdAndUpdate(
    req.params.id,
    text ? { $set: { adminNote: { text, updatedAt: new Date() } } } : { $unset: { adminNote: '' } },
    { new: true }
  ).select('adminNote');

  if (!order) throw error(404, 'Order not found.');

  return ok(res, { adminNote: order.adminNote || null, message: text ? 'Note saved.' : 'Note removed.' });
});

// PATCH /api/admin/products/:id/visibility  { isActive }
// Show or hide a product on the website without touching anything else.
const setProductVisibility = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw error(400, 'Invalid product.');
  if (typeof req.body?.isActive !== 'boolean') throw error(400, 'isActive must be true or false.');

  const { Product } = require('../models');
  const result = await Product.updateOne({ _id: req.params.id }, { $set: { isActive: req.body.isActive } });

  if (!result.matchedCount) throw error(404, 'Product not found.');

  return ok(res, { isActive: req.body.isActive, message: req.body.isActive ? 'Product website par dikh raha hai.' : 'Product website se chhup gaya.' });
});

module.exports = { saveNote, setProductVisibility };
