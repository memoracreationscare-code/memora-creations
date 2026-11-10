'use strict';

/*
  Product variants (size / colour).

  A "virtual product" is the product with the chosen option's name, price
  and stock filled in. The cart, checkout, orders, emails and Shiprocket
  already read name / sellingPrice / stock from the product, so they work
  for variants without further changes.
*/

function findVariant(product, variantId) {
  if (!product || !Array.isArray(product.variants) || !variantId) return null;

  return product.variants.find(v => String(v._id) === String(variantId)) || null;
}

function hasVariants(product) {
  return Boolean(product && Array.isArray(product.variants) && product.variants.length);
}

function plain(product) {
  return typeof product.toObject === 'function' ? product.toObject() : { ...product };
}

function virtualProduct(product, variant) {
  const base = plain(product);

  if (!variant) return base;

  const price = variant.price != null ? Number(variant.price) : Number(base.sellingPrice);
  const mrp = variant.originalPrice != null
    ? Number(variant.originalPrice)
    : Math.max(Number(base.originalPrice ?? price), price);

  return {
    ...base,
    name: `${base.name} (${variant.label})`,
    sellingPrice: price,
    originalPrice: Math.max(mrp, price),
    stock: Number(variant.stock) || 0,
    variantId: String(variant._id),
    variantLabel: variant.label
  };
}

// Admin input -> clean list, or throws a short message.
function cleanVariants(input, product) {
  if (input === undefined) return undefined;

  if (!Array.isArray(input)) throw new Error('Options must be a list.');
  if (input.length > 40) throw new Error('Too many options (maximum 40).');

  const seen = new Set();
  const out = [];

  for (const row of input) {
    const label = String(row && row.label || '').trim().slice(0, 60);
    const stock = Number(row && row.stock);

    if (!label) throw new Error('Every option needs a name (for example "Large / Red").');

    if (seen.has(label.toLowerCase())) throw new Error(`Option "${label}" is repeated.`);
    seen.add(label.toLowerCase());

    if (!Number.isInteger(stock) || stock < 0) {
      throw new Error(`Stock of "${label}" must be a whole number (0 or more).`);
    }

    const variant = { label, stock };

    if (row._id) variant._id = row._id; // keep the id so carts and orders stay linked

    for (const key of ['price', 'originalPrice']) {
      const raw = row[key];

      if (raw === undefined || raw === null || raw === '') continue;

      const n = Number(raw);

      if (!Number.isFinite(n) || n < 0) throw new Error(`Price of "${label}" is not valid.`);

      variant[key] = n;
    }

    if (
      variant.price != null &&
      variant.originalPrice != null &&
      variant.price > variant.originalPrice
    ) {
      throw new Error(`Price of "${label}" cannot be more than its MRP.`);
    }

    out.push(variant);
  }

  return out;
}

module.exports = { findVariant, hasVariants, virtualProduct, cleanVariants };
