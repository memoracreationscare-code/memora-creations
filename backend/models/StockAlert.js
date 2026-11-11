'use strict';

const mongoose = require('mongoose');

/* "Stock aane par batao": one waiting customer email for one product. */
const schema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 120 },
  notifiedAt: { type: Date, default: null }
}, { timestamps: true });

// one waiting request per product + email
schema.index({ product: 1, email: 1 }, { unique: true });
schema.index({ notifiedAt: 1, createdAt: 1 });

module.exports = mongoose.model('StockAlert', schema);
