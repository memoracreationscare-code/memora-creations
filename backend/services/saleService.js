'use strict';

/*
  Festival sale with a start and end time.

  - start: prices go down by `percent`, the old selling price is shown as
    the crossed-out price, and the original numbers are kept safely.
  - end: the original numbers are put back exactly.
  Runs with the other automatic jobs (every ~3 minutes).
  Do not change a product's price while its sale is running: the saved
  original price would come back at the end.
*/

const round = n => Math.round(Number(n) || 0);

/* The $set that puts a product on sale, or null if it cannot be. */
function saleUpdate(product, percent) {
  const factor = 1 - percent / 100;
  const selling = Number(product.sellingPrice);

  if (!(selling > 0)) return null;

  const saved = {
    sellingPrice: product.sellingPrice,
    originalPrice: product.originalPrice === undefined ? null : product.originalPrice,
    variants: (product.variants || []).map(v => ({
      price: v.price === undefined ? null : v.price,
      originalPrice: v.originalPrice === undefined ? null : v.originalPrice
    }))
  };

  const set = {
    'sale.applied': true,
    'sale.saved': saved,
    sellingPrice: Math.max(1, round(selling * factor)),
    originalPrice: Math.max(Number(product.originalPrice) || 0, selling)
  };

  (product.variants || []).forEach((v, i) => {
    if (v.price > 0) {
      set[`variants.${i}.price`] = Math.max(1, round(v.price * factor));
      set[`variants.${i}.originalPrice`] = Math.max(Number(v.originalPrice) || 0, v.price);
    }
  });

  return set;
}

/* The $set / $unset that puts the original prices back. */
function restoreUpdate(product) {
  const saved = product.sale && product.sale.saved;

  if (!saved) return { $unset: { sale: 1 } };

  const set = { sellingPrice: saved.sellingPrice };
  const unset = { sale: 1 };

  if (saved.originalPrice === null) unset.originalPrice = 1;
  else set.originalPrice = saved.originalPrice;

  (saved.variants || []).forEach((v, i) => {
    if (!(product.variants || [])[i]) return;
    if (v.price === null) unset[`variants.${i}.price`] = 1;
    else set[`variants.${i}.price`] = v.price;
    if (v.originalPrice === null) unset[`variants.${i}.originalPrice`] = 1;
    else set[`variants.${i}.originalPrice`] = v.originalPrice;
  });

  return { $set: set, $unset: unset };
}

async function sweepSales(Product = require('../models').Product, now = new Date()) {
  const result = { started: 0, ended: 0 };

  const toStart = await Product.find({
    'sale.percent': { $gt: 0 },
    'sale.applied': { $ne: true },
    'sale.startsAt': { $lte: now },
    'sale.endsAt': { $gt: now }
  }).limit(300).lean();

  for (const product of toStart) {
    const set = saleUpdate(product, product.sale.percent);

    if (!set) continue;

    const r = await Product.updateOne({ _id: product._id, 'sale.applied': { $ne: true } }, { $set: set });

    if (r.modifiedCount > 0 || r.nModified > 0) result.started += 1;
  }

  const toEnd = await Product.find({ 'sale.endsAt': { $lte: now } }).select('+sale.saved variants sale').limit(300).lean();

  for (const product of toEnd) {
    if (product.sale && product.sale.applied) {
      await Product.updateOne({ _id: product._id }, restoreUpdate(product));
    } else {
      await Product.updateOne({ _id: product._id }, { $unset: { sale: 1 } });   // never started: just clear it
    }

    result.ended += 1;
  }

  return result;
}

module.exports = { saleUpdate, restoreUpdate, sweepSales };
