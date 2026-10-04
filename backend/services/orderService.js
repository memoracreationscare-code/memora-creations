const mongoose = require('mongoose');
const { Cart, Order, Product } = require('../models');
const { error } = require('../utils/http');

const ORDER_STATUSES = ['Order Placed', 'Confirmed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];

function money(n) { return Math.round(Number(n) * 100) / 100; }
function deliveryFor(subtotal) {
  const threshold = Number(process.env.FREE_DELIVERY_THRESHOLD || 499);
  const charge = Number(process.env.DELIVERY_CHARGE || 49);
  return subtotal >= threshold ? 0 : charge;
}

async function getTrustedItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw error(400, 'At least one product is required.');
  const normalized = items.map(i => ({ productId: String(i.productId || i.product || ''), quantity: Number(i.quantity) }));
  if (normalized.some(i => !mongoose.isValidObjectId(i.productId) || !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 99)) {
    throw error(400, 'Invalid product or quantity.');
  }
  const merged = new Map();
  for (const item of normalized) merged.set(item.productId, (merged.get(item.productId) || 0) + item.quantity);
  const ids = [...merged.keys()];
  const products = await Product.find({ _id: { $in: ids }, isActive: true }).populate('category', 'name').lean();
  if (products.length !== ids.length) throw error(400, 'One or more products are unavailable.');
  const byId = new Map(products.map(p => [String(p._id), p]));
  const trusted = ids.map(id => {
    const p = byId.get(id);
    const quantity = merged.get(id);
    if (quantity > p.stock) throw error(409, `${p.name} does not have enough stock.`);
    return { product: p, quantity };
  });
  return trusted;
}

function totals(trustedItems) {
  const subtotal = money(trustedItems.reduce((sum, x) => sum + x.product.sellingPrice * x.quantity, 0));
  const original = money(trustedItems.reduce((sum, x) => sum + x.product.originalPrice * x.quantity, 0));
  const discount = money(Math.max(0, original - subtotal));
  const deliveryCharge = deliveryFor(subtotal);
  return { subtotal, original, discount, deliveryCharge, grandTotal: money(subtotal + deliveryCharge) };
}

async function buildOrderDocument({ user, address, items, paymentMethod, razorpayOrderId, clearCartOnPayment = false, session }) {
  const trusted = await getTrustedItems(items);
  const t = totals(trusted);
  const orderId = `MC-${new Date().getFullYear()}-${Date.now().toString().slice(-8)}`;
  const orderItems = trusted.map(({ product, quantity }) => ({
    product: product._id,
    productId: product.productId,
    name: product.name,
    imageUrl: product.images?.[0]?.url || '',
    quantity,
    unitPrice: product.sellingPrice,
    lineTotal: money(product.sellingPrice * quantity)
  }));
  const paymentStatus = paymentMethod === 'COD' ? 'COD_PENDING' : 'PENDING';
  return new Order({
    orderId,
    user: user._id,
    customer: { fullName: user.fullName, mobile: user.mobile, email: user.email || undefined },
    shippingAddress: address,
    items: orderItems,
    subtotal: t.subtotal,
    deliveryCharge: t.deliveryCharge,
    discount: t.discount,
    grandTotal: t.grandTotal,
    paymentMethod,
    paymentStatus,
    razorpayOrderId,
    clearCartOnPayment: paymentMethod === 'RAZORPAY' && clearCartOnPayment === true,
    orderStatus: 'Order Placed',
    statusHistory: [{ status: 'Order Placed', note: 'Order created.' }]
  });
}

async function reserveStock(order, session) {
  for (const item of order.items) {
    const updated = await Product.findOneAndUpdate(
      { _id: item.product, isActive: true, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity } },
      { new: true, session }
    );
    if (!updated) throw error(409, `${item.name} went out of stock. Please retry.`);
  }
  order.stockReserved = true;
}

async function releaseStock(order, session) {
  if (!order || !order.stockReserved) return;
  for (const item of order.items) {
    await Product.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } }, { session });
  }
  order.stockReserved = false;
}

async function createCodOrder({ user, address, items, clearCart = false }) {
  const session = await mongoose.startSession();
  try {
    let order;
    await session.withTransaction(async () => {
      order = await buildOrderDocument({ user, address, items, paymentMethod: 'COD', session });
      await reserveStock(order, session);
      await order.save({ session });
      if (clearCart) await Cart.updateOne({ user: user._id }, { $set: { items: [] } }, { session });
    });
    return order;
  } finally { await session.endSession(); }
}

async function createOnlinePendingOrder({ user, address, items, razorpayOrderId, clearCart = false }) {
  const session = await mongoose.startSession();
  try {
    let order;
    await session.withTransaction(async () => {
      order = await buildOrderDocument({ user, address, items, paymentMethod: 'RAZORPAY', razorpayOrderId, clearCartOnPayment: clearCart, session });
      await reserveStock(order, session);
      await order.save({ session });
    });
    return order;
  } finally { await session.endSession(); }
}

async function cancelPendingOnlineOrder(order) {
  if (!order || order.paymentMethod !== 'RAZORPAY' || !['PENDING', 'FAILED', 'CANCELLED'].includes(order.paymentStatus)) return order;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (order.orderStatus !== 'Cancelled') {
        await releaseStock(order, session);
        order.paymentStatus = order.paymentStatus === 'PENDING' ? 'FAILED' : order.paymentStatus;
        order.statusHistory.push({ status: order.orderStatus, note: 'Online payment attempt was not completed; stock released for retry.' });
        await order.save({ session });
      }
    });
    return order;
  } finally { await session.endSession(); }
}

module.exports = { ORDER_STATUSES, getTrustedItems, totals, buildOrderDocument, createCodOrder, createOnlinePendingOrder, cancelPendingOnlineOrder, reserveStock, releaseStock, deliveryFor, money };
