
/*
========================================
 MEMORA CREATIONS
 COUPON USER USAGE MODEL

 Per-customer coupon usage tracking
========================================
*/

const mongoose = require('mongoose');

const couponUserUsageSchema = new mongoose.Schema(
  {
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      required: true
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    usedCount: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: 'Usage count must be an integer.'
      }
    }
  },
  {
    timestamps: true
  }
);

/*
 One record per coupon and customer.
 Prevent duplicate counter documents.
*/

couponUserUsageSchema.index(
  {
    coupon: 1,
    user: 1
  },
  {
    unique: true,
    name: 'unique_coupon_customer'
  }
);

couponUserUsageSchema.index({
  user: 1,
  updatedAt: -1
});

module.exports = mongoose.model(
  'CouponUserUsage',
  couponUserUsageSchema
);
