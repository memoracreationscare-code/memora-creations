const mongoose = require('mongoose');

const productImageSchema = new mongoose.Schema({
  url: { type: String, required: true, trim: true },
  publicId: { type: String, required: true, trim: true },
  alt: { type: String, trim: true, maxlength: 150 }
}, { _id: false });

const productSchema = new mongoose.Schema({
  productId: { type: String, required: true, unique: true, index: true, trim: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 180 },
  slug: { type: String, required: true, unique: true, index: true, trim: true, lowercase: true },
  description: { type: String, required: true, trim: true, maxlength: 5000 },
  keywords: [{ type: String, trim: true, lowercase: true, maxlength: 50 }],
  images: { type: [productImageSchema], default: [] },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
  originalPrice: { type: Number, required: true, min: 0 },
  sellingPrice: { type: Number, required: true, min: 0 },
  discountPercent: { type: Number, default: 0, min: 0, max: 100 },
  stock: { type: Number, required: true, min: 0, default: 0, index: true },
  isFeatured: { type: Boolean, default: false, index: true },
  isNewArrival: { type: Boolean, default: true, index: true },
  isBestSeller: { type: Boolean, default: false, index: true },
  isActive: { type: Boolean, default: true, index: true }
}, { timestamps: true });

productSchema.index({ name: 'text', description: 'text', keywords: 'text' });
productSchema.index({ category: 1, sellingPrice: 1 });

productSchema.pre('validate', function(next) {
  if (this.sellingPrice > this.originalPrice) {
    return next(new Error('Selling price cannot exceed original price.'));
  }
  if (this.originalPrice > 0) {
    this.discountPercent = Math.round(((this.originalPrice - this.sellingPrice) / this.originalPrice) * 100);
  } else {
    this.discountPercent = 0;
  }
  next();
});

module.exports = mongoose.model('Product', productSchema);
productSchema.index({
  isActive: 1,
  createdAt: -1
});

productSchema.index({
  isActive: 1,
  sellingPrice: 1
});

productSchema.index({
  isActive: 1,
  category: 1,
  createdAt: -1
});

productSchema.index({
  isActive: 1,
  isBestSeller: -1,
  createdAt: -1
});
