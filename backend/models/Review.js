
const mongoose = require('mongoose');

/*
=========================================
 MEMORA CREATIONS
 PRODUCT REVIEWS AND RATINGS MODEL
=========================================
*/

const reviewSchema = new mongoose.Schema({

  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },

  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    validate: {
      validator: Number.isInteger,
      message: 'Rating must be a whole number.'
    }
  },

  title: {
    type: String,
    trim: true,
    maxlength: 120,
    default: ''
  },

  comment: {
    type: String,
    required: true,
    trim: true,
    minlength: 10,
    maxlength: 1500
  },

  photos: {
    type: [String],
    default: [],
    validate: {
      validator: function(value) {
        return Array.isArray(value) &&
          value.length <= 3 &&
          value.every(url =>
            /^https:\/\/res\.cloudinary\.com\/[a-zA-Z0-9_-]+\/image\/upload\//.test(url)
          );
      },
      message: 'Up to 3 valid Cloudinary photos are allowed.'
    }
  },

  verifiedPurchase: {
    type: Boolean,
    default: true
  },

  status: {
    type: String,
    enum: [
      'PENDING',
      'APPROVED',
      'REJECTED'
    ],
    default: 'PENDING',
    index: true
  },

  approvedAt: {
    type: Date,
    default: null
  }

}, {
  timestamps: true
});

/*
 One review per customer per product
*/

reviewSchema.index(
  { product: 1, user: 1 },
  { unique: true }
);

/*
 Public reviews sorting
*/

reviewSchema.index({
  product: 1,
  status: 1,
  createdAt: -1
});

/*
 Admin moderation sorting
*/

reviewSchema.index({
  status: 1,
  createdAt: -1
});

module.exports = mongoose.model(
  'Review',
  reviewSchema
);
