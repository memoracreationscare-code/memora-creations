'use strict';

/*
  Owner view of who buys: orders and money per customer.
  GET /api/admin/customers/summary   top customers + repeat rate
  GET /api/admin/customers/export    CSV of every customer with their totals
  Cancelled and unpaid online orders are not counted.
*/

const { asyncHandler, ok } = require('../utils/http');

const round2 = n => Math.round((Number(n) || 0) * 100) / 100;

async function statsFor(models) {
  const rows = await models.Order.aggregate([
    {
      $match: {
        orderStatus: { $ne: 'Cancelled' },
        $or: [{ paymentMethod: 'COD' }, { paymentStatus: 'SUCCESS' }],
        user: { $ne: null }
      }
    },
    {
      $group: {
        _id: '$user',
        orders: { $sum: 1 },
        spent: { $sum: '$grandTotal' },
        lastOrderAt: { $max: '$createdAt' }
      }
    },
    { $sort: { spent: -1 } },
    { $limit: 5000 }
  ]);

  const users = await models.User.find({ _id: { $in: rows.map(r => r._id) } })
    .select('fullName mobile email createdAt isActive').lean();
  const byId = new Map(users.map(u => [String(u._id), u]));

  return rows
    .map(r => {
      const u = byId.get(String(r._id));

      return u && {
        id: u._id, name: u.fullName || '', mobile: u.mobile || '', email: u.email || '',
        joinedAt: u.createdAt, orders: r.orders, spent: round2(r.spent), lastOrderAt: r.lastOrderAt
      };
    })
    .filter(Boolean);
}

function summarise(list) {
  const repeat = list.filter(c => c.orders >= 2).length;

  return {
    buyers: list.length,
    repeatBuyers: repeat,
    repeatRate: list.length ? Math.round((repeat / list.length) * 100) : 0,
    totalSpent: round2(list.reduce((s, c) => s + c.spent, 0)),
    top: list.slice(0, 10)
  };
}

// A cell starting with = + - @ can run as a formula in Excel: neutralise it.
const cell = v => {
  let s = String(v ?? '');

  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;

  return '"' + s.replace(/"/g, '""') + '"';
};

function toCsv(list) {
  const head = ['Name', 'Mobile', 'Email', 'Orders', 'Total spent (INR)', 'Last order', 'Joined'];
  const lines = list.map(c => [
    c.name, c.mobile, c.email, c.orders, c.spent,
    c.lastOrderAt ? new Date(c.lastOrderAt).toISOString().slice(0, 10) : '',
    c.joinedAt ? new Date(c.joinedAt).toISOString().slice(0, 10) : ''
  ].map(cell).join(','));

  return '﻿' + [head.map(cell).join(','), ...lines].join('\r\n');
}

const summary = asyncHandler(async (req, res) =>
  ok(res, { summary: summarise(await statsFor(require('../models')) ) })
);

const exportCsv = asyncHandler(async (req, res) => {
  const csv = toCsv(await statsFor(require('../models')));

  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="memora-customers.csv"',
    'Cache-Control': 'private, no-store'
  });

  return res.send(csv);
});

module.exports = { summary, exportCsv, statsFor, summarise, toCsv };
