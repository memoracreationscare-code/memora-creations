'use strict';

/*
  Admin -> Festival Sale (owner only)
  GET    /api/admin/sale   current sale summary
  POST   /api/admin/sale   { name, percent, startsAt, endsAt, categoryId? }
  DELETE /api/admin/sale   stop now and put every price back
*/

const mongoose = require('mongoose');
const { asyncHandler, error, ok } = require('../utils/http');
const { restoreUpdate, sweepSales } = require('../services/saleService');

const summary = asyncHandler(async (req, res) => {
  const { Product } = require('../models');
  const base = { 'sale.percent': { $gt: 0 } };
  const [total, running, one] = await Promise.all([
    Product.countDocuments(base),
    Product.countDocuments({ ...base, 'sale.applied': true }),
    Product.findOne(base).select('sale').lean()
  ]);

  return ok(res, {
    sale: one ? {
      name: one.sale.name, percent: one.sale.percent,
      startsAt: one.sale.startsAt, endsAt: one.sale.endsAt,
      products: total, running
    } : null
  });
});

const create = asyncHandler(async (req, res) => {
  const { Product } = require('../models');
  const name = String(req.body.name || '').trim().slice(0, 60) || 'Sale';
  const percent = Number(req.body.percent);
  const startsAt = new Date(req.body.startsAt);
  const endsAt = new Date(req.body.endsAt);

  if (!Number.isInteger(percent) || percent < 1 || percent > 90) throw error(400, 'Discount 1 se 90 ke beech ka poora number ho.');
  if (isNaN(startsAt) || isNaN(endsAt)) throw error(400, 'Start aur end ka date-time chunein.');
  if (endsAt <= startsAt) throw error(400, 'End time start ke baad ka hona chahiye.');
  if (endsAt <= new Date()) throw error(400, 'End time aage ka hona chahiye.');

  if (await Product.exists({ 'sale.percent': { $gt: 0 } })) {
    throw error(409, 'Ek sale pehle se chal rahi / laga di gayi hai. Pehle use band karein.');
  }

  const filter = { isActive: true };

  if (req.body.categoryId) {
    if (!mongoose.isValidObjectId(req.body.categoryId)) throw error(400, 'Invalid category.');
    filter.category = req.body.categoryId;
  }

  const r = await Product.updateMany(filter, { $set: { sale: { name, percent, startsAt, endsAt, applied: false } } });
  const count = r.modifiedCount ?? r.nModified ?? 0;

  if (!count) throw error(400, 'Is selection me koi product nahi mila.');

  await sweepSales();   // starts at once if the start time is already here

  return ok(res, { message: `Sale set ho gayi: ${count} product par ${percent}% off.`, products: count });
});

const stop = asyncHandler(async (req, res) => {
  const { Product } = require('../models');
  const list = await Product.find({ 'sale.percent': { $gt: 0 } }).select('+sale.saved variants sale').lean();

  for (const product of list) {
    await Product.updateOne(
      { _id: product._id },
      product.sale && product.sale.applied ? restoreUpdate(product) : { $unset: { sale: 1 } }
    );
  }

  return ok(res, { message: `Sale band ho gayi, ${list.length} product ke price wapas normal.` });
});

module.exports = { summary, create, stop };
