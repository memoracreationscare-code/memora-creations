const { Cart, Product } = require('../models');
const { asyncHandler, error, ok } = require('../utils/http');
const { positiveInt } = require('../utils/validation');

async function hydrate(cart) {
  await cart.populate({ path: 'items.product', select: 'productId name images sellingPrice originalPrice stock isActive category' });
  const items = cart.items.filter(i => i.product && i.product.isActive).map(i => ({ id: i._id, product: i.product, quantity: i.quantity, lineTotal: Math.round(i.product.sellingPrice * i.quantity * 100) / 100 }));
  const subtotal = Math.round(items.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100;
  const delivery = subtotal >= Number(process.env.FREE_DELIVERY_THRESHOLD || 499) ? 0 : (items.length ? Number(process.env.DELIVERY_CHARGE || 49) : 0);
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
  if (!positiveInt(quantity) || quantity > product.stock) throw error(409, 'Requested quantity is unavailable.');
  const cart = await Cart.findOneAndUpdate({ user: req.user._id }, { $setOnInsert: { user: req.user._id, items: [] } }, { upsert: true, new: true });
  const existing = cart.items.find(i => String(i.product) === String(product._id));
  const nextQty = (existing?.quantity || 0) + quantity;
  if (nextQty > product.stock) throw error(409, 'Quantity exceeds available stock.');
  if (existing) existing.quantity = nextQty; else cart.items.push({ product: product._id, quantity });
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
  if (quantity > product.stock) throw error(409, 'Quantity exceeds available stock.');
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
