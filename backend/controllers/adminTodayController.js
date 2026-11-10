'use strict';

/*
  GET /api/admin/today

  "Aaj ka kaam": what the owner has to do now, plus today's sales.
  Read-only. Days are counted in India time (IST).
*/

const { Order } = require('../models');
const { asyncHandler, ok } = require('../utils/http');

const IST_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function istDayStart(now = new Date()) {
  return new Date(Math.floor((now.getTime() + IST_MS) / DAY_MS) * DAY_MS - IST_MS);
}

// Orders that count as a sale: not cancelled, and paid (online) or cash-on-delivery.
const SALE = {
  orderStatus: { $ne: 'Cancelled' },
  $or: [{ paymentMethod: 'COD' }, { paymentStatus: 'SUCCESS' }]
};

async function salesBetween(from, to, model = Order) {
  const [row] = await model.aggregate([
    { $match: { ...SALE, createdAt: { $gte: from, $lt: to } } },
    { $group: { _id: null, orders: { $sum: 1 }, amount: { $sum: '$grandTotal' } } }
  ]);

  return { orders: row?.orders || 0, amount: Math.round((row?.amount || 0) * 100) / 100 };
}

async function buildToday(now = new Date(), model = Order) {
  const start = istDayStart(now);
  const yesterday = new Date(start.getTime() - DAY_MS);
  const paidOrCod = { $or: [{ paymentMethod: 'COD' }, { paymentStatus: 'SUCCESS' }] };

  const [toShip, inTransit, codToCollect, refunds, today, before] = await Promise.all([
    model.countDocuments({ orderStatus: { $in: ['Order Placed', 'Confirmed', 'Packed'] }, ...paidOrCod }),
    model.countDocuments({ orderStatus: { $in: ['Shipped', 'Out for Delivery'] } }),
    model.aggregate([
      { $match: { paymentMethod: 'COD', orderStatus: 'Delivered', paymentStatus: 'COD_PENDING' } },
      { $group: { _id: null, orders: { $sum: 1 }, amount: { $sum: '$grandTotal' } } }
    ]),
    model.countDocuments({ 'refund.status': 'PROCESSING' }),
    salesBetween(start, new Date(start.getTime() + DAY_MS), model),
    salesBetween(yesterday, start, model)
  ]);

  return {
    toShip,
    inTransit,
    codToCollect: { orders: codToCollect[0]?.orders || 0, amount: Math.round((codToCollect[0]?.amount || 0) * 100) / 100 },
    refundsProcessing: refunds,
    today,
    yesterday: before
  };
}

const today = asyncHandler(async (_req, res) => ok(res, await buildToday()));

module.exports = { today, buildToday, istDayStart };
