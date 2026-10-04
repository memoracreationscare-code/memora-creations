const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true, index: true, minlength: 2, maxlength: 80 },
  slug: { type: String, required: true, unique: true, index: true, trim: true, lowercase: true },
  description: { type: String, trim: true, maxlength: 500 },
  imageUrl: { type: String, trim: true },
  isActive: { type: Boolean, default: true, index: true }
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);
