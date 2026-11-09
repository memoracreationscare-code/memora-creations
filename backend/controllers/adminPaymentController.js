'use strict';

/*
=========================================
 MEMORA CREATIONS
 ADMIN: ONLINE PAYMENTS

   GET  /api/admin/payments
   POST /api/admin/payments/:id/verify
   POST /api/admin/payments/:id/refund

 Verify = ask Cashfree if the payment is really PAID and
 for the right amount, and save the UPI ID / UTR details.
 Refund = send a refund through Cashfree (full or part).
 A full refund of an order that is not shipped also
 cancels the order (stock, coupon, Shiprocket).
=========================================
*/

const crypto = require('crypto');
const mongoose = require('mongoose');

const { Order } = require('../models');
const { asyncHandler, error, ok } = require('../utils/http');
const codAdvanceRules = require('../utils/codAdvance');
const paymentUtil = require('../utils/paymentDetails');
const cancellation = require('../services/orderCancellation');
const { summarizeRefunds } = require('../services/refundSync');
const { getCashfreeRefunds } = require('../services/cashfreeRefundService');

const {
  fetchCashfreeOrder,
  fetchCashfreePayments,
  isCashfreePaymentSuccessful,
  createCashfreeRefund
} = require('../services/cashfreeService');

const money = n => Math.round(Number(n) * 100) / 100;

function shape(o) {
  return {
    id: String(o._id),
    orderId: o.orderId,
    cashfreeOrderId: o.cashfreeOrderId || '',
    cashfreePaymentId: o.cashfreePaymentId || '',
    createdAt: o.createdAt,
    orderStatus: o.orderStatus,
    paymentStatus: o.paymentStatus,
    amount: money(codAdvanceRules.onlineAmount(o)),
    orderTotal: money(o.grandTotal || 0),
    isCodAdvance: Boolean(o.codAdvance && o.codAdvance.enabled),
    fullName: o.shippingAddress?.fullName || '',
    mobile: o.shippingAddress?.mobile || '',
    details: o.paymentDetails || null,
    refund: o.refund && o.refund.status
      ? { status: o.refund.status, amount: o.refund.amount }
      : null
  };
}

const listPayments = asyncHandler(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 60) : '';

  const filter = {
    paymentMethod: 'CASHFREE',
    paymentStatus: { $in: ['SUCCESS', 'PENDING'] }
  };

  if (q) {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { orderId: new RegExp(safe, 'i') },
      { 'paymentDetails.upiId': new RegExp(safe, 'i') },
      { 'paymentDetails.bankReference': new RegExp(safe, 'i') },
      { cashfreeOrderId: new RegExp(safe, 'i') }
    ];
  }

  const orders = await Order.find(filter)
    .sort({ createdAt: -1 })
    .limit(150)
    .lean();

  const paid = orders.filter(o => o.paymentStatus === 'SUCCESS');

  return ok(res, {
    payments: paid.map(shape),
    totals: {
      count: paid.length,
      amount: money(paid.reduce((s, o) => s + codAdvanceRules.onlineAmount(o), 0)),
      refunded: money(paid.reduce((s, o) => s + (o.refund?.amount || 0), 0))
    }
  });
});

const verifyPayment = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw error(400, 'Invalid order.');

  const order = await Order.findById(req.params.id);

  if (!order || order.paymentMethod !== 'CASHFREE' || !order.cashfreeOrderId) {
    throw error(404, 'Online payment order not found.');
  }

  const expected = money(codAdvanceRules.onlineAmount(order));
  const gateway = await fetchCashfreeOrder(order.cashfreeOrderId);
  const paid = gateway.order_id === order.cashfreeOrderId &&
    isCashfreePaymentSuccessful(gateway, expected);

  let details = null;

  if (paid) {
    details = paymentUtil.extractPaymentDetails(
      paymentUtil.pickSuccessfulPayment(await fetchCashfreePayments(order.cashfreeOrderId))
    );

    const set = {};

    if (details) {
      set.paymentDetails = details;
      if (details.cfPaymentId) set.cashfreePaymentId = details.cfPaymentId;
    }

    // Cashfree says PAID but our record was still pending (missed webhook).
    if (order.paymentStatus === 'PENDING' && order.orderStatus !== 'Cancelled') {
      set.paymentStatus = 'SUCCESS';
    }

    if (Object.keys(set).length) {
      await Order.updateOne({ _id: order._id }, { $set: set });
    }
  }

  return ok(res, {
    verified: paid,
    gatewayStatus: gateway.order_status,
    expectedAmount: expected,
    gatewayAmount: money(gateway.order_amount),
    details,
    message: paid
      ? 'Payment verified with Cashfree: PAID and the amount matches.'
      : `Cashfree says this payment is "${gateway.order_status}" (or the amount does not match). Do not treat it as paid.`
  });
});

const refundPayment = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw error(400, 'Invalid order.');

  if (req.body?.confirmed !== true) {
    throw error(400, 'Please confirm the refund.');
  }

  const note = String(req.body?.note || 'Refund by Memora Creations').trim().slice(0, 100);

  const order = await Order.findById(req.params.id);

  if (!order || order.paymentMethod !== 'CASHFREE' || !order.cashfreeOrderId) {
    throw error(404, 'Online payment order not found.');
  }

  if (order.paymentStatus !== 'SUCCESS') {
    throw error(409, 'Only paid orders can be refunded.');
  }

  const paidAmount = money(codAdvanceRules.onlineAmount(order));
  const gateway = await fetchCashfreeOrder(order.cashfreeOrderId);

  if (
    gateway.order_id !== order.cashfreeOrderId ||
    !isCashfreePaymentSuccessful(gateway, paidAmount)
  ) {
    throw error(409, 'Cashfree does not confirm this payment. Refund stopped.');
  }

  const existing = await getCashfreeRefunds(order.cashfreeOrderId);
  const already = money(summarizeRefunds(existing).total);
  const remaining = money(paidAmount - already);

  if (remaining <= 0) {
    throw error(409, 'This payment is already fully refunded.');
  }

  const amount = req.body?.amount === undefined || req.body.amount === ''
    ? remaining
    : money(req.body.amount);

  if (!Number.isFinite(amount) || amount <= 0 || amount > remaining) {
    throw error(400, `Refund amount must be between 1 paise and Rs ${remaining}.`);
  }

  // Same click twice -> same refund id -> Cashfree refuses the duplicate.
  const refundId = 'MCAD' + crypto
    .createHash('sha256')
    .update(`${order.cashfreeOrderId}|${amount}|${existing.length}`)
    .digest('hex')
    .slice(0, 20);

  await createCashfreeRefund({
    orderId: order.cashfreeOrderId,
    refundId,
    amount,
    note
  });

  const totalRefunded = money(already + amount);
  const full = totalRefunded >= paidAmount - 0.01;
  const notes = [`Refund of Rs ${amount} sent to Cashfree from the admin panel (${refundId}).`];
  let target = order;

  if (full && ['Order Placed', 'Confirmed'].includes(order.orderStatus)) {
    target = await cancellation.cancelInDatabase(order, {
      reason: 'Order cancelled: full refund made from the admin panel.',
      keepPaymentSuccess: true
    });

    const sr = await cancellation.cancelShiprocketIfBooked(target);

    if (sr) notes.push(sr);
  }

  target.statusHistory.push({
    status: target.orderStatus,
    note: notes.join(' ').slice(0, 300),
    changedAt: new Date()
  });

  target.refund = { status: 'PROCESSING', amount: totalRefunded, updatedAt: new Date() };
  target.refundCheckedAt = new Date();

  if (target.autoCancel) target.markModified('autoCancel');

  await target.save();

  return ok(res, {
    message: full
      ? 'Full refund sent. It reaches the customer in 5-7 working days.'
      : `Refund of Rs ${amount} sent. Remaining refundable: Rs ${money(paidAmount - totalRefunded)}.`,
    refund: target.refund,
    orderStatus: target.orderStatus
  });
});

module.exports = { listPayments, verifyPayment, refundPayment };
