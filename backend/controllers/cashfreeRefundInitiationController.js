const mongoose = require('mongoose');
const crypto = require('crypto');
const { Order } = require('../models');
const CashfreeRefundAttempt = require('../models/CashfreeRefundAttempt');
const { getCashfreeConfig, fetchCashfreeOrder, isCashfreePaymentSuccessful } = require('../services/cashfreeService');
const { getCashfreeRefunds } = require('../services/cashfreeRefundService');
const { sendSandboxRefund } = require('../services/cashfreeRefundInitiationService');
const { asyncHandler, error, ok } = require('../utils/http');
const REQUEST_MARKER = 'CUSTOMER_CASHFREE_CANCEL_REQUEST';

const initiateSandboxRefund = asyncHandler(async (req, res) => {
  if (process.env.CASHFREE_SANDBOX_REFUNDS_ENABLED !== 'true' ||
      getCashfreeConfig().env !== 'sandbox') {
    throw error(403, 'Refund initiation is disabled outside explicitly enabled sandbox.');
  }
  const id = String(req.params.id || '').trim();
  if (!/^[A-Za-z0-9_-]{3,100}$/.test(id)) throw error(400, 'Invalid order identifier.');
  const lookup = mongoose.isValidObjectId(id)
    ? { $or: [{ _id: id }, { orderId: id }] }
    : { orderId: id };
  const order = await Order.findOne(lookup).lean();
  if (!order || order.paymentMethod !== 'CASHFREE') throw error(404, 'Cashfree order not found.');
  if (req.body?.confirmedOrderNumber !== order.orderId || req.body?.confirmed !== true) {
    throw error(400, 'Explicit order number confirmation required.');
  }
  if (order.paymentStatus !== 'SUCCESS' || !['Order Placed', 'Confirmed'].includes(order.orderStatus)) {
    throw error(409, 'Only early, confirmed-paid orders can be submitted for review.');
  }
  if (!Array.isArray(order.statusHistory) ||
      !order.statusHistory.some(h => String(h.note || '').startsWith(REQUEST_MARKER))) {
    throw error(409, 'Customer cancellation/refund request is required.');
  }
  if (!order.cashfreeOrderId || !Number.isFinite(order.grandTotal) || order.grandTotal <= 0) {
    throw error(409, 'Incomplete payment reference or amount.');
  }
  const gateway = await fetchCashfreeOrder(order.cashfreeOrderId);
  if (gateway.order_id !== order.cashfreeOrderId ||
      !isCashfreePaymentSuccessful(gateway, order.grandTotal)) {
    throw error(409, 'Gateway payment cannot be confirmed.');
  }
  // Never initiate if any Cashfree refund exists, regardless of its status.
  const existing = await getCashfreeRefunds(order.cashfreeOrderId);
  if (existing.length) throw error(409, 'Cashfree already reports a refund. Manual review required.');
  // Ensure MongoDB unique indexes are ready before the irreversible API call.
  await CashfreeRefundAttempt.init();
  const refundId = 'MCRF' + crypto.randomBytes(12).toString('hex');
  let attempt;
  try {
    attempt = await CashfreeRefundAttempt.create({
      order: order._id, cashfreeOrderId: order.cashfreeOrderId,
      refundId, amount: order.grandTotal, admin: req.admin._id
    });
  } catch (e) {
    if (e.code === 11000) throw error(409, 'Refund attempt already exists. Verify status; never retry automatically.');
    throw e;
  }
  try {
    const result = await sendSandboxRefund({ orderId: order.cashfreeOrderId, refundId, amount: order.grandTotal });
    await CashfreeRefundAttempt.updateOne({ _id: attempt._id }, {
      $set: { state: 'SUBMITTED', gatewayStatus: String(result.refund_status || 'UNKNOWN') }
    });
    return ok(res, {
      message: 'Sandbox refund submitted. Recheck Cashfree refund status.',
      refundId, refundStatus: String(result.refund_status || 'UNKNOWN'),
      orderModified: false, stockReleased: false, couponReleased: false
    });
  } catch (e) {
    await CashfreeRefundAttempt.updateOne({ _id: attempt._id }, {
      $set: { state: 'UNKNOWN_REQUIRES_REVIEW' }
    }).catch(() => {});
    throw error(409, 'Refund outcome uncertain. Do NOT retry. Check Cashfree refund status and seek manual reconciliation.');
  }
});
module.exports = { initiateSandboxRefund };
