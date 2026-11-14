const { Cart, Product } = require('../models');
const { asyncHandler, error, ok } = require('../utils/http');
const { positiveInt } = require('../utils/validation');
const { findVariant, hasVariants, virtualProduct } = require('../utils/variants');
const photos = require('../services/customPhotoService');

async function hydrate(cart) {
  await cart.populate({ path: 'items.product', select: 'productId name images sellingPrice originalPrice stock isActive category variants personalization' });
  const items = [];
  for (const i of cart.items) {
    if (!i.product || !i.product.isActive) continue;
    let product = i.product;
    if (hasVariants(i.product)) {
      // An option that was removed or never chosen cannot be bought: hide it.
      const variant = findVariant(i.product, i.variant);
      if (!variant) continue;
      product = virtualProduct(i.product, variant);
    }
    items.push({ id: i._id, product, variantId: i.variant ? String(i.variant) : undefined, customPhotos: i.customPhotos && i.customPhotos.length ? i.customPhotos.map(x => ({ url: x.url, publicId: x.publicId })) : undefined, customNote: i.customNote || undefined, quantity: i.quantity, lineTotal: Math.round(product.sellingPrice * i.quantity * 100) / 100 });
  }
  const subtotal = Math.round(items.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100;
  const settings = require('../services/settingsService').peek();
  const delivery = subtotal >= settings.freeDeliveryAbove ? 0 : (items.length ? settings.deliveryCharge : 0);
  return { items, subtotal, deliveryCharge: delivery, grandTotal: Math.round((subtotal + delivery) * 100) / 100 };
}

const getCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOneAndUpdate({ user: req.user._id }, { $setOnInsert: { user: req.user._id, items: [] } }, { upsert: true, new: true });
  return ok(res, { cart: await hydrate(cart) });
});

const addItem = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ _id: req.body.productId, isActive: true });
  const quantity = Number(req.body.quantity || 1);
  if (!product) throw error(404, 'Product not found.');
  let variant = null;
  if (hasVariants(product)) {
    variant = findVariant(product, req.body.variantId);
    if (!variant) throw error(400, 'Please choose an option (size / colour) first.');
  }
  const available = variant ? variant.stock : product.stock;
  if (!positiveInt(quantity) || quantity > available) throw error(409, 'Requested quantity is unavailable.');
  const cart = await Cart.findOneAndUpdate({ user: req.user._id }, { $setOnInsert: { user: req.user._id, items: [] } }, { upsert: true, new: true });

  // Personalised product (photo frame): the customer's photos are required and
  // every add is its own cart line, so two frames can carry two different photos.
  // Photos are normally uploaded later, on the checkout page; here they are optional.
  let custom;
  try {
    custom = photos.checkCustomization(product, req.body.customPhotos, req.body.customNote, req.user._id, { required: false });
  } catch (e) {
    throw error(e.status || 400, e.message);
  }

  if (custom.photos.length) {
    if (cart.items.length >= 50) throw error(409, 'Cart is full.');
    cart.items.push({ product: product._id, quantity, ...(variant ? { variant: variant._id } : {}), customPhotos: custom.photos, ...(custom.note ? { customNote: custom.note } : {}) });
    await cart.save();
    return ok(res, { message: 'Added to cart.', cart: await hydrate(cart) }, 201);
  }

  const existing = cart.items.find(i => !(i.customPhotos && i.customPhotos.length) && String(i.product) === String(product._id) && String(i.variant || '') === String(variant ? variant._id : ''));
  const nextQty = (existing?.quantity || 0) + quantity;
  if (nextQty > available) throw error(409, 'Quantity exceeds available stock.');
  if (existing) existing.quantity = nextQty; else cart.items.push({ product: product._id, quantity, ...(variant ? { variant: variant._id } : {}) });
  await cart.save();
  return ok(res, { message: 'Added to cart.', cart: await hydrate(cart) }, 201);
});

const updateItem = asyncHandler(async (req, res) => {
  const quantity = Number(req.body.quantity);
  if (!positiveInt(quantity)) throw error(400, 'Quantity must be a positive integer.');
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) throw error(404, 'Cart not found.');
  const item = cart.items.id(req.params.id);
  if (!item) throw error(404, 'Cart item not found.');
  const product = await Product.findById(item.product);
  if (!product || !product.isActive) throw error(404, 'Product unavailable.');
  const variant = hasVariants(product) ? findVariant(product, item.variant) : null;
  if (hasVariants(product) && !variant) throw error(404, 'This option is no longer available.');
  if (quantity > (variant ? variant.stock : product.stock)) throw error(409, 'Quantity exceeds available stock.');
  item.quantity = quantity; await cart.save();
  return ok(res, { cart: await hydrate(cart) });
});

const removeItem = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) throw error(404, 'Cart not found.');
  const item = cart.items.id(req.params.id); if (!item) throw error(404, 'Cart item not found.');
  item.deleteOne(); await cart.save();
  return ok(res, { message: 'Item removed.', cart: await hydrate(cart) });
});

module.exports = { getCart, addItem, updateItem, removeItem };
