'use strict';

/*
  GET /api/admin/reports?from=YYYY-MM-DD&to=YYYY-MM-DD   (India dates, "to" included)

  Read-only sales report: totals, best-selling products, orders by state,
  by payment method and per day. A "sale" is an order that is not
  cancelled and is either cash-on-delivery or paid online.
*/

const { Order } = require('../models');
const { asyncHandler, error, ok } = require('../utils/http');

const IST_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function istDay(text) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text || ''));

  if (!m) return null;

  const date = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]) - IST_MS);

  return Number.isNaN(date.getTime()) ? null : date;
}

function range(query, now = new Date()) {
  const today = new Date(Math.floor((now.getTime() + IST_MS) / DAY_MS) * DAY_MS - IST_MS);
  const monthStart = new Date(today.getTime() - (new Date(today.getTime() + IST_MS).getUTCDate() - 1) * DAY_MS);
  const from = istDay(query.from) || monthStart;
  const to = new Date((istDay(query.to) || today).getTime() + DAY_MS);

  if (to <= from) throw error(400, '"To" date must not be before "From" date.');
  if (to - from > 366 * DAY_MS) throw error(400, 'Choose a range of one year or less.');

  return { from, to };
}

const money = n => Math.round((Number(n) || 0) * 100) / 100;

async function buildReport(from, to, model = Order) {
  const match = {
    createdAt: { $gte: from, $lt: to },
    orderStatus: { $ne: 'Cancelled' },
    $or: [{ paymentMethod: 'COD' }, { paymentStatus: 'SUCCESS' }]
  };

  const [totals, products, states, payments, days, cancelled] = await Promise.all([
    model.aggregate([{ $match: match }, { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: '$grandTotal' } } }]),
    model.aggregate([
      { $match: match }, { $unwind: '$items' },
      { $group: { _id: '$items.name', quantity: { $sum: '$items.quantity' }, revenue: { $sum: '$items.lineTotal' } } },
      { $sort: { quantity: -1, revenue: -1 } }, { $limit: 15 }
    ]),
    model.aggregate([
      { $match: match },
      { $group: { _id: { $ifNull: ['$shippingAddress.state', 'Unknown'] }, orders: { $sum: 1 }, revenue: { $sum: '$grandTotal' } } },
      { $sort: { orders: -1 } }, { $limit: 15 }
    ]),
    model.aggregate([
      { $match: match },
      { $group: { _id: '$paymentMethod', orders: { $sum: 1 }, revenue: { $sum: '$grandTotal' } } },
      { $sort: { orders: -1 } }
    ]),
    model.aggregate([
      { $match: match },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+05:30' } }, orders: { $sum: 1 }, revenue: { $sum: '$grandTotal' } } },
      { $sort: { _id: 1 } }
    ]),
    model.countDocuments({ createdAt: { $gte: from, $lt: to }, orderStatus: 'Cancelled' })
  ]);

  const orders = totals[0]?.orders || 0;
  const revenue = money(totals[0]?.revenue);

  return {
    from, to,
    summary: { orders, revenue, average: orders ? money(revenue / orders) : 0, cancelled },
    products: products.map(p => ({ name: p._id, quantity: p.quantity, revenue: money(p.revenue) })),
    states: states.map(s => ({ state: s._id, orders: s.orders, revenue: money(s.revenue) })),
    payments: payments.map(p => ({ method: p._id, orders: p.orders, revenue: money(p.revenue) })),
    days: days.map(d => ({ date: d._id, orders: d.orders, revenue: money(d.revenue) }))
  };
}

const report = asyncHandler(async (req, res) => {
  const { from, to } = range(req.query);

  return ok(res, await buildReport(from, to));
});

module.exports = { report, buildReport, range, istDay };
