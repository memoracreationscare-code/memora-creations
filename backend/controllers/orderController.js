const { Order, Cart } = require('../models');
const { asyncHandler, error, ok } = require('../utils/http');
const { validateAddress } = require('../utils/validation');
const mongoose = require('mongoose');
const { getTrustedItems, totals, createCodOrder, releaseStock } = require('../services/orderService');

const preview = asyncHandler(async (req, res) => {
  const trusted = await getTrustedItems(req.body.items);
  return ok(res, { ...totals(trusted), items: trusted.map(x => ({ productId: x.product.productId, _id: x.product._id, name: x.product.name, imageUrl: x.product.images?.[0]?.url || '', quantity: x.quantity, unitPrice: x.product.sellingPrice, lineTotal: x.product.sellingPrice * x.quantity })) });
});

const createCod = asyncHandler(async (req, res) => {
  const address = req.body.address; const msg = validateAddress(address); if (msg) throw error(400, msg);
  const order = await createCodOrder({ user: req.user, address, items: req.body.items, clearCart: req.body.clearCart === true });
  return ok(res, { message: 'COD order placed successfully.', order }, 201);
});

const listOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).lean();
  return ok(res, { orders });
});
const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id }).lean();
  if (!order) throw error(404, 'Order not found.'); return ok(res, { order });
});
const cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id }); if (!order) throw error(404, 'Order not found.');
  if (!['Order Placed', 'Confirmed'].includes(order.orderStatus)) throw error(400, 'This order can no longer be cancelled.');
  const session=await mongoose.startSession();
  try { await session.withTransaction(async()=>{ await releaseStock(order,session); order.orderStatus='Cancelled'; order.statusHistory.push({status:'Cancelled',note:'Cancelled by customer.'}); await order.save({session}); }); } finally { await session.endSession(); }
  return ok(res, { order });
});
module.exports = { preview, createCod, listOrders, getOrder, cancelOrder };
