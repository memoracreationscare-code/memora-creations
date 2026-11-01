/* MEMORA CREATIONS — admin refund verification (read-only). */
const mongoose = require('mongoose');
const { Order } = require('../models');
const { asyncHandler, error, ok } = require('../utils/http');
const { getCashfreeRefunds, fetchCashfreeOrder, isCashfreePaymentSuccessful } = require('../services/cashfreeRefundService');

const inspectRefunds = asyncHandler(async (req, res) => {
  const id = String(req.params.id || '');
  if (!mongoose.isValidObjectId(id)) throw error(400, 'Valid order ID is required.');
  const order = await Order.findById(id).select('orderId cashfreeOrderId paymentMethod paymentStatus orderStatus grandTotal couponCode couponDiscount').lean();
  if (!order) throw error(404, 'Order not found.');
  if (order.paymentMethod !== 'CASHFREE' || !order.cashfreeOrderId) {
    throw error(400, 'This is not a Cashfree order.');
  }
  const gateway = await fetchCashfreeOrder(order.cashfreeOrderId);
  if (String(gateway.order_id) !== String(order.cashfreeOrderId)) throw error(409, 'Cashfree order identity mismatch.');
  const amountMatches = Math.round(Number(gateway.order_amount) * 100) === Math.round(Number(order.grandTotal) * 100) && gateway.order_currency === 'INR';
  if (!amountMatches) throw error(409, 'Cashfree amount or currency mismatch. Manual review required.');
  const refunds = await getCashfreeRefunds(order.cashfreeOrderId);
  const safeRefunds = refunds.map(r => ({
    refundId: String(r.refund_id || ''),
    cashfreeRefundId: String(r.cf_refund_id || ''),
    amount: Number(r.refund_amount || 0),
    currency: String(r.refund_currency || ''),
    status: String(r.refund_status || 'UNKNOWN'),
    createdAt: r.created_at || null,
    processedAt: r.processed_at || null
  }));
  return ok(res, {
    mode: 'READ_ONLY',
    order: { id: order._id, orderId: order.orderId, paymentStatus: order.paymentStatus, orderStatus: order.orderStatus, grandTotal: order.grandTotal, couponCode: order.couponCode || null, couponDiscount: order.couponDiscount || 0 },
    cashfree: { orderStatus: gateway.order_status, paid: isCashfreePaymentSuccessful(gateway, order.grandTotal) },
    refunds: safeRefunds,
    refundInitiated: false,
    orderModified: false
  });
});

module.exports = { inspectRefunds };
