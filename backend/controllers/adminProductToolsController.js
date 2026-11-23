'use strict';

/*
  Admin product tools (owner only)
  (Copying a product already exists in the Products page: the "Copy" button.)

  POST /api/admin/products/bulk   { updates: [ { id, stock?, sellingPrice?, originalPrice? } ] }
       Changes stock / prices of many products at once (max 100).
       Nothing is saved unless EVERY row is valid. Products with size/colour
       options keep their per-option stock (stock is skipped for them), and
       products inside a running festival sale keep their sale price (price
       is skipped for them). Skipped rows are listed in the answer.

  GET  /api/admin/stock-requests
       "Wapas aane par batao" requests: how many people wait for each product.
       Customer emails are NOT returned.
*/

const mongoose = require('mongoose');
const { asyncHandler, error, ok } = require('../utils/http');

const MAX_ROWS = 100;
const MAX_STOCK = 1000000;

/* ---------- bulk update ---------- */

function isWhole(n) {
  return Number.isInteger(n) && n >= 0 && n <= MAX_STOCK;
}

/*
  Pure planner. `products` = array of lean products (with sale/variants/name),
  `rows` = what the admin sent. Returns { changes, skipped } or throws a
  message string (as Error) for the first invalid row.
*/
function planBulk(products, rows) {
  const byId = new Map(products.map(p => [String(p._id), p]));
  const changes = [];
  const skipped = [];
  const seen = new Set();

  for (const row of rows) {
    const id = String((row && row.id) || '');
    const p = byId.get(id);

    if (!p) throw new Error('Ek product nahi mila. Page refresh karke dobara try karein.');
    if (seen.has(id)) throw new Error(`"${p.name}" do baar aaya hai.`);
    seen.add(id);

    const set = {};
    const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
    const inSale = !!(p.sale && p.sale.applied);

    if (row.stock !== undefined && row.stock !== null && row.stock !== '') {
      const stock = Number(row.stock);

      if (!isWhole(stock)) throw new Error(`"${p.name}": stock poora number (0 ya zyada) hona chahiye.`);

      if (hasVariants) skipped.push({ id, name: p.name, reason: 'Size/colour wale product ka stock option se badlein.' });
      else if (stock !== p.stock) set.stock = stock;
    }

    const wantsPrice =
      (row.sellingPrice !== undefined && row.sellingPrice !== null && row.sellingPrice !== '') ||
      (row.originalPrice !== undefined && row.originalPrice !== null && row.originalPrice !== '');

    if (wantsPrice) {
      const original = row.originalPrice === undefined || row.originalPrice === null || row.originalPrice === ''
        ? p.originalPrice
        : Number(row.originalPrice);
      const selling = row.sellingPrice === undefined || row.sellingPrice === null || row.sellingPrice === ''
        ? p.sellingPrice
        : Number(row.sellingPrice);

      if (!Number.isFinite(original) || !Number.isFinite(selling) || original <= 0 || selling <= 0 || original > 10000000 || selling > 10000000) {
        throw new Error(`"${p.name}": daam sahi number hona chahiye.`);
      }

      if (selling > original) throw new Error(`"${p.name}": selling price MRP se zyada nahi ho sakta.`);

      if (inSale) {
        skipped.push({ id, name: p.name, reason: 'Festival sale chal rahi hai, daam sale khatam hone par badlein.' });
      } else {
        if (Math.round(original * 100) !== Math.round(p.originalPrice * 100)) set.originalPrice = Math.round(original * 100) / 100;
        if (Math.round(selling * 100) !== Math.round(p.sellingPrice * 100)) set.sellingPrice = Math.round(selling * 100) / 100;
      }
    }

    if (Object.keys(set).length) changes.push({ id, name: p.name, set });
  }

  return { changes, skipped };
}

const bulk = asyncHandler(async (req, res) => {
  const { Product } = require('../models');
  const rows = Array.isArray((req.body || {}).updates) ? req.body.updates : [];

  if (!rows.length) throw error(400, 'Kuch badlav nahi mila.');
  if (rows.length > MAX_ROWS) throw error(400, `Ek baar me ${MAX_ROWS} se zyada products nahi.`);

  const ids = rows.map(r => String((r && r.id) || ''));

  if (!ids.every(id => mongoose.isValidObjectId(id))) throw error(400, 'Product galat hai.');

  const products = await Product.find({ _id: { $in: ids } })
    .select('name stock originalPrice sellingPrice variants sale.applied')
    .lean();

  let plan;

  try {
    plan = planBulk(products, rows);
  } catch (e) {
    throw error(400, e.message);
  }

  if (plan.changes.length) {
    await Product.bulkWrite(plan.changes.map(c => ({
      updateOne: { filter: { _id: c.id }, update: { $set: c.set } }
    })));
  }

  return ok(res, {
    updated: plan.changes.length,
    skipped: plan.skipped,
    message: plan.changes.length
      ? `${plan.changes.length} product update ho gaye.`
      : 'Koi badlav nahi hua.'
  });
});

/* ---------- stock requests ---------- */

const stockRequests = asyncHandler(async (_req, res) => {
  const { StockAlert, Product } = require('../models');

  const groups = await StockAlert.aggregate([
    {
      $group: {
        _id: '$product',
        waiting: { $sum: { $cond: [{ $eq: ['$notifiedAt', null] }, 1, 0] } },
        notified: { $sum: { $cond: [{ $eq: ['$notifiedAt', null] }, 0, 1] } },
        oldest: { $min: { $cond: [{ $eq: ['$notifiedAt', null] }, '$createdAt', null] } },
        latest: { $max: '$createdAt' }
      }
    },
    { $sort: { waiting: -1, latest: -1 } },
    { $limit: 200 }
  ]);

  const products = await Product.find({ _id: { $in: groups.map(g => g._id) } })
    .select('name stock isActive images')
    .lean();
  const byId = new Map(products.map(p => [String(p._id), p]));

  const rows = groups
    .map(g => {
      const p = byId.get(String(g._id));

      if (!p) return null;

      return {
        productId: String(g._id),
        name: p.name,
        image: p.images && p.images[0] ? p.images[0].url : '',
        stock: p.stock,
        isActive: p.isActive,
        waiting: g.waiting,
        notified: g.notified,
        oldest: g.oldest,
        latest: g.latest
      };
    })
    .filter(Boolean);

  return ok(res, {
    rows,
    totalWaiting: rows.reduce((sum, r) => sum + r.waiting, 0)
  });
});

module.exports = { bulk, stockRequests, planBulk };
