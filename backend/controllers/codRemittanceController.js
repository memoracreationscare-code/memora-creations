'use strict';

/*
  ADMIN: COD REMITTANCE (read-only)

  Shows, for every Cash-on-Delivery order, where the money is, plus
  the live Shiprocket wallet balance. Shiprocket's own COD payout
  list is on its website (Billing > COD Remittance); this page does
  not read it.
*/

const { Order, ShipmentTracking } = require('../models');
const { asyncHandler, ok } = require('../utils/http');
const { configured, getWalletBalance } = require('../services/shiprocketService');
const { classifyCodOrder, summarize } = require('../utils/codRemittance');
const { cashOnDelivery } = require('../utils/codAdvance');

const MAX_ORDERS = 500;

async function readWallet() {
  if (!configured()) return { connected: false, balance: null };

  try {
    const data = await getWalletBalance();
    const balance =
      data?.data?.balance_amount ??
      data?.balance_amount ??
      data?.data?.balance ??
      data?.balance ??
      null;

    return { connected: true, balance: balance === null ? null : Number(balance) };
  } catch {
    return { connected: false, balance: null };
  }
}

const listCodRemittance = asyncHandler(async (_req, res) => {
  const orders = await Order.find({
    $or: [
      { paymentMethod: 'COD' },
      { 'codAdvance.enabled': true }
    ],
    orderStatus: { $ne: 'Cancelled' }
  })
    .sort({ createdAt: -1 })
    .limit(MAX_ORDERS)
    .select('orderId createdAt orderStatus paymentStatus paymentMethod grandTotal codAdvance shippingAddress statusHistory')
    .lean();

  const shipments = await ShipmentTracking.find({
    order: { $in: orders.map(order => order._id) }
  })
    .select('order awbCode courierName shipmentStatus deliveredAt')
    .lean();

  const byOrder = new Map(shipments.map(item => [String(item.order), item]));
  const now = new Date();

  const rows = orders.map(order => {
    const shipment = byOrder.get(String(order._id));
    const info = classifyCodOrder(order, shipment, now);

    return {
      orderMongoId: String(order._id),
      orderId: order.orderId,
      createdAt: order.createdAt,
      customer: order.shippingAddress?.fullName || '',
      mobile: order.shippingAddress?.mobile || '',
      // Cash the courier collects (the balance if an advance was paid).
      amount: cashOnDelivery(order),
      advancePaid: order.codAdvance?.enabled
        ? Number(order.codAdvance.advanceAmount || 0)
        : 0,
      orderStatus: order.orderStatus,
      awbCode: shipment?.awbCode || '',
      courierName: shipment?.courierName || '',
      courierStatus: shipment?.shipmentStatus || '',
      ...info
    };
  });

  const { totals, counts } = summarize(rows);
  const wallet = await readWallet();

  return ok(res, { rows, totals, counts, wallet });
});

module.exports = { listCodRemittance };
