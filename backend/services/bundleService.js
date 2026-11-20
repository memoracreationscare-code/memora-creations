'use strict';

/*
  Bundle offers: "buy all of these together, save Rs X per set".
  Pure maths lives in computeBundleDiscount (easy to test);
  activeBundles() reads the live offers.

  Rules:
  - a set needs one of every product; sets = the smallest quantity among members
  - a unit is used by one bundle only (best saving is applied first)
  - the saving can never push the items below Rs 0
  - the coupon and free-delivery rules still use the normal subtotal
*/

const money = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function idOf(item) {
  const p = item.product || {};
  return String(p._id || item.productId || p.productId || '');
}

function computeBundleDiscount(items, bundles, subtotal) {
  const stock = new Map();
  for (const it of items || []) {
    const id = idOf(it);
    if (!id) continue;
    stock.set(id, (stock.get(id) || 0) + (Number(it.quantity) || 0));
  }

  const list = (bundles || [])
    .filter(b => b && b.isActive !== false && Array.isArray(b.products) && b.products.length >= 2)
    .map(b => ({
      name: b.name,
      ids: [...new Set(b.products.map(String))],
      amount: Number(b.discountAmount) || 0
    }))
    .filter(b => b.ids.length >= 2 && b.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  let total = 0;
  const applied = [];

  for (const b of list) {
    const sets = Math.min(...b.ids.map(id => stock.get(id) || 0));
    if (sets < 1) continue;
    b.ids.forEach(id => stock.set(id, stock.get(id) - sets));
    total += sets * b.amount;
    applied.push({ name: b.name, sets, amount: money(sets * b.amount) });
  }

  const cap = Math.max(0, Number(subtotal) || 0);
  total = money(Math.min(total, cap));

  return { discount: total, applied, names: applied.map(a => a.name) };
}

async function activeBundles() {
  const { Bundle } = require('../models');
  return Bundle.find({ isActive: true }).lean();
}

async function bundleFor(items, subtotal) {
  let bundles = [];
  try {
    bundles = await activeBundles();
  } catch (_) {
    bundles = []; // never block an order because the offers could not be read
  }
  return computeBundleDiscount(items, bundles, subtotal);
}

module.exports = { computeBundleDiscount, activeBundles, bundleFor };
