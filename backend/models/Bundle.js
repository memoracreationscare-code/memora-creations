const mongoose = require('mongoose');

/*
  Bundle offer: when every product of a bundle is in the cart,
  the customer gets a fixed rupee amount off per complete set.
*/
const bundleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    products: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
      validate: {
        validator: v => Array.isArray(v) && v.length >= 2 && v.length <= 6,
        message: 'A bundle needs 2 to 6 products.'
      }
    },
    discountAmount: { type: Number, required: true, min: 1, max: 100000 },
    isActive: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Bundle', bundleSchema);
