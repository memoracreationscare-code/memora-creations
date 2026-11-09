const mongoose = require('mongoose');

// One sandbox initiation per order. Failed/unknown attempts require manual review.
const schema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  cashfreeOrderId: { type: String, required: true },
  refundId: { type: String, required: true, unique: true },
  amount: { type: Number, required: true, min: 0.01 },
  state: { type: String, enum: ['IN_FLIGHT', 'SUBMITTED', 'UNKNOWN_REQUIRES_REVIEW'], default: 'IN_FLIGHT' },
  gatewayStatus: { type: String, default: '' },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  automatic: { type: Boolean, default: false }
}, { timestamps: true });
module.exports = mongoose.model('CashfreeRefundAttempt', schema);
