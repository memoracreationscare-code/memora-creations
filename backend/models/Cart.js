const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1 },
  variant: { type: mongoose.Schema.Types.ObjectId, default: undefined },
  // personalised products: the customer's own photos + a short note
  customPhotos: { type: [{ _id: false, url: String, publicId: String }], default: undefined },
  customNote: { type: String, maxlength: 300, default: undefined }
}, { _id: true });

const cartSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  items: { type: [cartItemSchema], default: [] },
  reminderSentAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Cart', cartSchema);
