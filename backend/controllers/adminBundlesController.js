'use strict';

/*
  Admin -> Bundle offers
  GET    /api/admin/bundles        list (with product names)
  POST   /api/admin/bundles        { name, productIds[], discountAmount, isActive }
  PUT    /api/admin/bundles/:id    same fields (all optional)
  DELETE /api/admin/bundles/:id
*/

const mongoose = require('mongoose');
const { asyncHandler, error, ok } = require('../utils/http');

function clean(body, current) {
  const data = {};

  if (body.name !== undefined || !current) {
    const name = String(body.name || '').trim().slice(0, 80);
    if (!name) throw error(400, 'Bundle ka naam likhein.');
    data.name = name;
  }

  if (body.productIds !== undefined || !current) {
    const ids = [...new Set((Array.isArray(body.productIds) ? body.productIds : []).map(String))];
    if (ids.length < 2 || ids.length > 6) throw error(400, 'Bundle me 2 se 6 alag products chunein.');
    if (!ids.every(id => mongoose.Types.ObjectId.isValid(id))) throw error(400, 'Product galat hai.');
    data.products = ids;
  }

  if (body.discountAmount !== undefined || !current) {
    const amount = Number(body.discountAmount);
    if (!Number.isFinite(amount) || amount < 1 || amount > 100000) {
      throw error(400, 'Discount 1 se 1,00,000 rupaye ke beech ho.');
    }
    data.discountAmount = Math.round(amount * 100) / 100;
  }

  if (body.isActive !== undefined) data.isActive = body.isActive === true;

  return data;
}

const list = asyncHandler(async (_req, res) => {
  const { Bundle } = require('../models');
  const rows = await Bundle.find()
    .populate('products', 'name sellingPrice isActive')
    .sort({ createdAt: -1 })
    .lean();
  return ok(res, { bundles: rows });
});

async function assertProducts(ids) {
  const { Product } = require('../models');
  const found = await Product.countDocuments({ _id: { $in: ids } });
  if (found !== ids.length) throw error(400, 'Kuch product mila nahi.');
}

const create = asyncHandler(async (req, res) => {
  const { Bundle } = require('../models');
  const data = clean(req.body || {});
  await assertProducts(data.products);
  const row = await Bundle.create({ ...data, isActive: data.isActive !== false });
  return ok(res, { bundle: row, message: 'Bundle ban gaya.' });
});

const update = asyncHandler(async (req, res) => {
  const { Bundle } = require('../models');
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw error(404, 'Bundle nahi mila.');
  const current = await Bundle.findById(req.params.id);
  if (!current) throw error(404, 'Bundle nahi mila.');
  const data = clean(req.body || {}, current);
  if (data.products) await assertProducts(data.products);
  Object.assign(current, data);
  await current.save();
  return ok(res, { bundle: current, message: 'Bundle update ho gaya.' });
});

const remove = asyncHandler(async (req, res) => {
  const { Bundle } = require('../models');
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw error(404, 'Bundle nahi mila.');
  await Bundle.deleteOne({ _id: req.params.id });
  return ok(res, { message: 'Bundle hata diya.' });
});

module.exports = { list, create, update, remove, clean };
