'use strict';

/*
=========================================
 MEMORA CREATIONS
 AUTOMATIC ORDER CANCELLATION

 When a customer cancels an order that is
 not shipped yet (Order Placed / Confirmed):

   1. Cash on delivery   -> cancelled at once
   2. Online, not paid   -> Cashfree order is
                            closed, then cancelled
   3. Online, paid       -> cancelled, then the
                            money is refunded
                            through Cashfree
                            (needs AUTO_REFUND_ENABLED=true)

 Always: stock and coupon are given back, and
 if a Shiprocket order was already made it is
 cancelled there too. If a step outside our
 database fails, the order is still cancelled
 and a red alert is shown in the admin panel.
=========================================
*/

const crypto = require('crypto');
const mongoose = require('mongoose');

const { Order, ShipmentTracking } = require('../models');
const CashfreeRefundAttempt = require('../models/CashfreeRefundAttempt');
const codAdvanceRules = require('../utils/codAdvance');
const { error } = require('../utils/http');
const { releaseStock } = require('./orderService');
const { releaseCoupon } = require('./couponUsageService');

const {
  fetchCashfreeOrder,
  isCashfreePaymentSuccessful,
  createCashfreeRefund,
  terminateCashfreeOrder
} = require('./cashfreeService');

const { getCashfreeRefunds } = require('./cashfreeRefundService');
const { cancelShiprocketOrder } = require('./shiprocketService');

const CANCELLABLE = ['Order Placed', 'Confirmed'];

function autoRefundEnabled() {
  return String(process.env.AUTO_REFUND_ENABLED || '').toLowerCase() === 'true';
}

function shortError(e) {
  return String((e && e.message) || e || 'Unknown error').slice(0, 280);
}

/* Checks everything that must be true before we touch the order. */
async function checkBeforeCancel(order) {

  if (order.orderStatus === 'Cancelled') {
    throw error(409, 'This order is already cancelled.');
  }

  if (!CANCELLABLE.includes(order.orderStatus)) {
    throw error(400, 'This order can no longer be cancelled.');
  }

  if (order.paymentMethod === 'COD') {

    if (order.paymentStatus !== 'COD_PENDING') {
      throw error(409, 'This COD order cannot be cancelled automatically.');
    }

    return { needsRefund: false, terminate: false };
  }

  if (order.paymentMethod !== 'CASHFREE') {
    throw error(409, 'Online payment orders require support-assisted cancellation.');
  }

  const online = codAdvanceRules.onlineAmount(order);

  if (order.paymentStatus === 'SUCCESS') {

    if (!autoRefundEnabled()) {
      throw error(409, 'AUTO_REFUND_DISABLED');
    }

    const gateway = await fetchCashfreeOrder(order.cashfreeOrderId);

    if (
      gateway.order_id !== order.cashfreeOrderId ||
      !isCashfreePaymentSuccessful(gateway, online)
    ) {
      throw error(409, 'Payment could not be verified. Please contact customer care.');
    }

    const existing = await getCashfreeRefunds(order.cashfreeOrderId);

    if (existing.length) {
      throw error(409, 'A refund already exists for this order. Please contact customer care.');
    }

    return { needsRefund: true, terminate: false, amount: online };
  }

  if (order.paymentStatus !== 'PENDING') {
    throw error(409, 'This order cannot be cancelled automatically.');
  }

  // Unpaid: make sure no payment is arriving right now.
  if (order.cashfreeOrderId) {

    const gateway = await fetchCashfreeOrder(order.cashfreeOrderId);

    if (gateway.order_status === 'PAID') {
      throw error(
        409,
        'Your payment is being confirmed. Please try again in a minute.'
      );
    }

    return {
      needsRefund: false,
      terminate: gateway.order_status === 'ACTIVE'
    };
  }

  return { needsRefund: false, terminate: false };
}


/* Cancels in our database: status, stock and coupon. All or nothing. */
async function cancelInDatabase(order, { reason, keepPaymentSuccess }) {

  const session = await mongoose.startSession();
  let cancelled = null;

  try {
    await session.withTransaction(async () => {

      const fresh = await Order.findById(order._id).session(session);

      if (!fresh || !CANCELLABLE.includes(fresh.orderStatus)) {
        throw error(409, 'Order status has changed. Please refresh.');
      }

      if (fresh.paymentStatus !== order.paymentStatus) {
        throw error(409, 'Payment details changed. Cancellation stopped.');
      }

      await releaseStock(fresh, session);

      if (fresh.couponUsageReserved === true) {
        if (!fresh.coupon) {
          throw error(409, 'Order coupon reservation is incomplete.');
        }

        await releaseCoupon({
          couponId: fresh.coupon,
          userId: fresh.user,
          session
        });

        fresh.couponUsageReserved = false;
      }

      fresh.orderStatus = 'Cancelled';

      // A paid order keeps SUCCESS until the refund is recorded.
      if (!keepPaymentSuccess) {
        fresh.paymentStatus = 'CANCELLED';
      }

      fresh.autoCancel = {
        at: new Date(),
        shiprocket: 'NOT_NEEDED',
        refundStatus: 'NOT_NEEDED'
      };

      fresh.statusHistory.push({
        status: 'Cancelled',
        note: String(reason).slice(0, 300),
        changedAt: new Date()
      });

      await fresh.save({ session });

      cancelled = fresh;
    });
  } finally {
    await session.endSession();
  }

  return cancelled;
}

/* Cancels a booked Shiprocket order. Returns a short note, or ''. */
async function cancelShiprocketIfBooked(cancelled) {

  try {
    const shipment = await ShipmentTracking.findOne({ order: cancelled._id }).lean();

    if (shipment && shipment.shiprocketOrderId) {
      await cancelShiprocketOrder(shipment.shiprocketOrderId);

      cancelled.autoCancel.shiprocket = 'CANCELLED';
      return 'Shiprocket order cancelled automatically.';
    }
  } catch (e) {
    cancelled.autoCancel.shiprocket = 'FAILED';
    cancelled.autoCancel.error = 'Shiprocket: ' + shortError(e);
    return 'Shiprocket cancel FAILED - cancel it in Shiprocket.';
  }

  return '';
}

async function autoCancelOrder(order, { reason = 'Order cancelled by customer.' } = {}) {

  const plan = await checkBeforeCancel(order);

  if (plan.terminate) {
    try {
      await terminateCashfreeOrder(order.cashfreeOrderId);
    } catch (e) {
      throw error(409, 'Could not close the payment link. Please try again in a minute.');
    }
  }

  /* 1. Database changes, all or nothing */

  const cancelled = await cancelInDatabase(order, {
    reason,
    keepPaymentSuccess: plan.needsRefund
  });

  const notes = [];

  /* 2. Shiprocket: stop a shipment that was already booked */

  const srNote = await cancelShiprocketIfBooked(cancelled);

  if (srNote) notes.push(srNote);

  /* 3. Refund the money */

  if (plan.needsRefund) {

    const refundId = 'MCRF' + crypto.randomBytes(12).toString('hex');

    try {
      await CashfreeRefundAttempt.init();

      await CashfreeRefundAttempt.create({
        order: cancelled._id,
        cashfreeOrderId: cancelled.cashfreeOrderId,
        refundId,
        amount: plan.amount,
        automatic: true
      });

      await createCashfreeRefund({
        orderId: cancelled.cashfreeOrderId,
        refundId,
        amount: plan.amount,
        note: 'Order ' + cancelled.orderId + ' cancelled by customer'
      });

      await CashfreeRefundAttempt.updateOne(
        { refundId },
        { $set: { state: 'SUBMITTED', gatewayStatus: 'SUBMITTED' } }
      );

      cancelled.autoCancel.refundStatus = 'SUBMITTED';
      cancelled.autoCancel.refundId = refundId;
      cancelled.autoCancel.refundAmount = plan.amount;
      notes.push('Refund of Rs ' + plan.amount + ' sent to Cashfree (' + refundId + ').');

    } catch (e) {
      await CashfreeRefundAttempt.updateOne(
        { refundId },
        { $set: { state: 'UNKNOWN_REQUIRES_REVIEW' } }
      ).catch(() => {});

      cancelled.autoCancel.refundStatus = 'FAILED';
      cancelled.autoCancel.refundId = refundId;
      cancelled.autoCancel.refundAmount = plan.amount;
      cancelled.autoCancel.error =
        ((cancelled.autoCancel.error || '') + ' Refund: ' + shortError(e)).trim().slice(0, 300);
      notes.push('Refund FAILED - check Cashfree and refund by hand.');
    }
  }

  if (notes.length) {
    cancelled.statusHistory.push({
      status: 'Cancelled',
      note: notes.join(' ').slice(0, 300),
      changedAt: new Date()
    });
  }

  cancelled.markModified('autoCancel');
  await cancelled.save();

  return cancelled;
}

module.exports = {
  autoCancelOrder,
  autoRefundEnabled,
  cancelInDatabase,
  cancelShiprocketIfBooked
};
