
const mongoose = require('mongoose');

/*
====================================
 MEMORA CREATIONS
 COUPON MODEL
====================================
*/

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      minlength: 3,
      maxlength: 30,
      match: /^[A-Z0-9_-]+$/
    },

    description: {
      type: String,
      trim: true,
      maxlength: 300,
      default: ''
    },

    discountType: {
      type: String,
      required: true,
      enum: ['PERCENTAGE', 'FIXED']
    },

    discountValue: {
      type: Number,
      required: true,
      min: 0.01,
      validate: {
        validator: function(value) {
          return (
            Number.isFinite(value) &&
            (
              this.discountType !== 'PERCENTAGE' ||
              value <= 100
            )
          );
        },
        message:
          'Percentage discount cannot exceed 100.'
      }
    },

    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0
    },

    maxDiscountAmount: {
      type: Number,
      default: null,
      min: 0
    },

    startsAt: {
      type: Date,
      default: Date.now
    },

    expiresAt: {
      type: Date,
      required: true
    },

    usageLimit: {
      type: Number,
      required: true,
      min: 1
    },

    usedCount: {
      type: Number,
      default: 0,
      min: 0
    },

    perUserLimit: {
      type: Number,
      default: 1,
      min: 1
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true
    },

    // Owner ticks this to let the AI chat tell customers about this code.
    showInChat: {
      type: Boolean,
      default: false
    },

    // Only for a customer who has never placed an order.
    firstOrderOnly: {
      type: Boolean,
      default: false
    },

    // Personal coupon: only this customer can use it (referral rewards).
    allowedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },

    source: {
      type: String,
      enum: ['ADMIN', 'WELCOME', 'REFERRAL_FRIEND', 'REFERRAL_REWARD'],
      default: 'ADMIN'
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    }
  },
  {
    timestamps: true
  }
);

/*
====================================
 VALIDATION
====================================
*/

couponSchema.pre('validate', function(next) {
  if (
    this.startsAt &&
    this.expiresAt &&
    this.expiresAt <= this.startsAt
  ) {
    return next(
      new Error(
        'Coupon expiry must be after start date.'
      )
    );
  }

  if (
    this.usedCount > this.usageLimit
  ) {
    return next(
      new Error(
        'Used count cannot exceed usage limit.'
      )
    );
  }

  next();
});

/*
====================================
 INDEXES
====================================
*/

couponSchema.index({
  isActive: 1,
  expiresAt: 1
});

couponSchema.index({
  createdAt: -1
});

/*
====================================
 EXPORT
====================================
*/

module.exports = mongoose.model(
  'Coupon',
  couponSchema
);
