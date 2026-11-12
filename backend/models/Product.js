
const mongoose = require('mongoose');


/* =========================
   PRODUCT IMAGE SCHEMA
========================= */

const productImageSchema = new mongoose.Schema({

  url: {
    type: String,
    required: true,
    trim: true
  },

  publicId: {
    type: String,
    required: true,
    trim: true
  },

  alt: {
    type: String,
    trim: true,
    maxlength: 150
  }

}, {
  _id: false
});


/* =========================
   PRODUCT SCHEMA
========================= */

const productSchema = new mongoose.Schema({

  productId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true
  },

  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 180
  },

  slug: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true,
    lowercase: true
  },

  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },

  keywords: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 50
  }],

  images: {
    type: [productImageSchema],
    default: []
  },

  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
    index: true
  },

  originalPrice: {
    type: Number,
    required: true,
    min: 0
  },

  sellingPrice: {
    type: Number,
    required: true,
    min: 0
  },

  discountPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },

  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
    index: true
  },

  /* =========================
     VARIANTS (size / colour ...)

     Optional. A product without
     variants works exactly as before.
     With variants, each option has its
     own stock (and optionally its own
     price) and `stock` above is the
     total of all options.
  ========================= */

  /* =========================
     FESTIVAL SALE (Admin -> Festival Sale)
     The sale job lowers the price at startsAt and puts the
     saved original prices back at endsAt. Orders and payments
     always read the normal price fields, so nothing else changes.
  ========================= */

  sale: {
    name: { type: String, trim: true, maxlength: 60 },
    percent: { type: Number, min: 1, max: 90 },
    startsAt: Date,
    endsAt: Date,
    applied: { type: Boolean, default: false },
    saved: { type: Object, select: false }
  },

  variants: {
    type: [{
      label: { type: String, required: true, trim: true, maxlength: 60 },
      price: { type: Number, min: 0, default: undefined },
      originalPrice: { type: Number, min: 0, default: undefined },
      stock: { type: Number, required: true, min: 0, default: 0 }
    }],
    default: []
  },


  /* =========================
     SHIPROCKET PACKAGE DETAILS

     Optional fields:
     Existing products remain valid.

     Weight is in kilograms.
     Dimensions are in centimeters.

     Values must represent the
     product's packed parcel.
  ========================= */

  shippingWeightKg: {
    type: Number,
    min: 0.001,
    max: 100,
    default: undefined
  },

  packageLengthCm: {
    type: Number,
    min: 0.1,
    max: 1000,
    default: undefined
  },

  packageWidthCm: {
    type: Number,
    min: 0.1,
    max: 1000,
    default: undefined
  },

  packageHeightCm: {
    type: Number,
    min: 0.1,
    max: 1000,
    default: undefined
  },


  /* =========================
     EXISTING PRODUCT FLAGS
  ========================= */

  isFeatured: {
    type: Boolean,
    default: false,
    index: true
  },

  isNewArrival: {
    type: Boolean,
    default: true,
    index: true
  },

  isBestSeller: {
    type: Boolean,
    default: false,
    index: true
  },

  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  // average of APPROVED customer reviews (kept up to date when a review is approved)
  ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
  ratingCount: { type: Number, default: 0, min: 0 },

  // set when the owner was emailed that this product is nearly out of stock
  lowStockAlertedAt: {
    type: Date,
    default: undefined
  }

}, {
  timestamps: true
});


/* =========================
   EXISTING DATABASE INDEXES
========================= */

productSchema.index({
  name: 'text',
  description: 'text',
  keywords: 'text'
});

productSchema.index({
  category: 1,
  sellingPrice: 1
});


/* Active products sorted by newest */

productSchema.index({
  isActive: 1,
  createdAt: -1
});


/* Active products sorted by price */

productSchema.index({
  isActive: 1,
  sellingPrice: 1
});


/* Category-wise newest products */

productSchema.index({
  isActive: 1,
  category: 1,
  createdAt: -1
});


/* Popular / best-selling products */

productSchema.index({
  isActive: 1,
  isBestSeller: -1,
  createdAt: -1
});


/* =========================
   PRODUCT VALIDATION
========================= */

productSchema.pre('validate', function(next) {

  if (Array.isArray(this.variants) && this.variants.length) {

    this.stock = this.variants.reduce(
      (sum, v) => sum + (Number(v.stock) || 0),
      0
    );

  }


  if (
    this.sellingPrice >
    this.originalPrice
  ) {

    return next(
      new Error(
        'Selling price cannot exceed original price.'
      )
    );

  }


  if (this.originalPrice > 0) {

    this.discountPercent = Math.round(
      (
        (
          this.originalPrice -
          this.sellingPrice
        ) /
        this.originalPrice
      ) * 100
    );

  } else {

    this.discountPercent = 0;

  }


  next();

});


/* =========================
   EXPORT PRODUCT MODEL
   KEEP THIS AT THE END
========================= */

module.exports = mongoose.model(
  'Product',
  productSchema
);
