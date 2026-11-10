'use strict';

/*
  Test-order cleanup (admin only).

  Removes ORDERS CREATED BEFORE a cut-off date (default: the launch day,
  12 Nov 2026, India time) so the dashboard numbers start clean.

  Safety:
  - never touches orders on/after the cut-off, and the cut-off can never
    be in the future;
  - orders that were paid online and not refunded are SKIPPED and listed,
    so no money is forgotten;
  - every deleted order is first copied into the `orders_backup`
    collection, and its reserved stock is given back;
  - the delete needs the word DELETE typed as confirmation.
*/

const mongoose = require('mongoose');
const { Order, Product } = require('../models');
const { asyncHandler, error, ok } = require('../utils/http');

const LAUNCH = '2026-11-12T00:00:00+05:30';

function cutoffFrom(raw, now = new Date()) {
  const date = new Date(raw || LAUNCH);

  if (Number.isNaN(date.getTime())) throw error(400, 'Date is not valid.');

  return date > now ? now : date;
}

// An online payment that is still "money in hand" must be refunded first.
function skipReason(order) {
  const online = order.paymentMethod && order.paymentMethod !== 'COD';
  const paid = order.paymentStatus === 'SUCCESS' || order.paymentStatus === 'PAID';
  const refunded = order.refund?.status === 'REFUNDED' || order.paymentStatus === 'REFUNDED';

  if (online && paid && !refunded) return 'Online payment received, refund not done yet';

  return '';
}

function plan(orders) {
  const remove = [];
  const skipped = [];

  for (const order of orders) {
    const why = skipReason(order);

    if (why) skipped.push({ order, why });
    else remove.push(order);
  }

  return { remove, skipped };
}

const row = o => ({
  orderId: o.orderId,
  createdAt: o.createdAt,
  status: o.orderStatus,
  payment: `${o.paymentMethod || ''} ${o.paymentStatus || ''}`.trim(),
  total: o.grandTotal
});

async function find(before) {
  return Order.find({ createdAt: { $lt: before } }).sort({ createdAt: 1 }).lean();
}

const preview = asyncHandler(async (req, res) => {
  const before = cutoffFrom(req.query.before);
  const { remove, skipped } = plan(await find(before));

  return ok(res, {
    before,
    count: remove.length,
    total: Math.round(remove.reduce((s, o) => s + (Number(o.grandTotal) || 0), 0) * 100) / 100,
    orders: remove.slice(0, 100).map(row),
    skipped: skipped.map(s => ({ ...row(s.order), why: s.why }))
  });
});

async function giveStockBack(order) {
  if (order.stockReserved !== true) return;

  for (const item of order.items || []) {
    await Product.updateOne(
      item.variantId ? { _id: item.product, 'variants._id': item.variantId } : { _id: item.product },
      item.variantId
        ? { $inc: { stock: item.quantity, 'variants.$.stock': item.quantity } }
        : { $inc: { stock: item.quantity } }
    );
  }
}

async function runCleanup(before, deps = {}) {
  const backup = deps.backup || (docs => mongoose.connection.collection('orders_backup').insertMany(docs));
  const del = deps.remove || (ids => Order.deleteMany({ _id: { $in: ids } }));
  const restock = deps.restock || giveStockBack;
  const orders = deps.orders || await find(before);

  const { remove, skipped } = plan(orders);

  if (!remove.length) return { deleted: 0, skipped: skipped.length };

  // 1. backup first - if this fails nothing is deleted
  await backup(remove.map(o => ({ ...o, backedUpAt: new Date(), backupReason: 'test-order cleanup' })));

  // 2. stock back, 3. delete
  for (const order of remove) await restock(order);

  await del(remove.map(o => o._id));

  return { deleted: remove.length, skipped: skipped.length };
}

const cleanup = asyncHandler(async (req, res) => {
  if (String(req.body?.confirm || '').trim() !== 'DELETE') {
    throw error(400, 'Type the word DELETE to confirm.');
  }

  const result = await runCleanup(cutoffFrom(req.body?.before));

  return ok(res, { ...result, message: `${result.deleted} test order(s) removed (backup saved in orders_backup).` });
});

module.exports = { preview, cleanup, runCleanup, cutoffFrom, skipReason, plan };
