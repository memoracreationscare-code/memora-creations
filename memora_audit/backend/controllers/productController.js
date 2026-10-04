const { Product, Category } = require('../models');
const { asyncHandler, error, ok } = require('../utils/http');
const { cleanString, nonNegativeNumber } = require('../utils/validation');

function slugify(s) { return cleanString(s, 180).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function serialize(p) { return { ...p, discountPercent: p.discountPercent ?? 0 }; }

const listProducts = asyncHandler(async (req, res) => {
  const { q = '', category = '', sort = 'newest', page = 1, limit = 24, featured, newArrival, bestSeller, offers } = req.query;
  const filter = { isActive: true };
  if (category) filter.category = category;
  if (featured === 'true') filter.isFeatured = true;
  if (newArrival === 'true') filter.isNewArrival = true;
  if (bestSeller === 'true') filter.isBestSeller = true;
  if (offers === 'true') filter.discountPercent = { $gt: 0 };
  if (q.trim()) filter.$or = [{ $text: { $search: q.trim() } }, { name: { $regex: q.trim(), $options: 'i' } }, { keywords: { $regex: q.trim(), $options: 'i' } }];
  const sortMap = { low: { sellingPrice: 1 }, high: { sellingPrice: -1 }, newest: { createdAt: -1 }, popular: { isBestSeller: -1, createdAt: -1 } };
  const pageNum = Math.max(1, Number(page) || 1); const pageSize = Math.min(48, Math.max(1, Number(limit) || 24));
  const [products, total] = await Promise.all([
    Product.find(filter).populate('category', 'name slug').sort(sortMap[sort] || sortMap.newest).skip((pageNum - 1) * pageSize).limit(pageSize).lean(),
    Product.countDocuments(filter)
  ]);
  return ok(res, { products: products.map(serialize), pagination: { page: pageNum, limit: pageSize, total, pages: Math.ceil(total / pageSize) } });
});

const getProduct = asyncHandler(async (req, res) => {
  const key=String(req.params.id||''); const ors=[{productId:key},{slug:key}]; if(require('mongoose').isValidObjectId(key)) ors.unshift({_id:key}); const p = await Product.findOne({ $or: ors, isActive: true }).populate('category', 'name slug').lean();
  if (!p) throw error(404, 'Product not found.');
  return ok(res, { product: serialize(p) });
});

const listCategories = asyncHandler(async (_req, res) => ok(res, { categories: await Category.find({ isActive: true }).sort({ name: 1 }).lean() }));

module.exports = { listProducts, getProduct, listCategories, slugify };
