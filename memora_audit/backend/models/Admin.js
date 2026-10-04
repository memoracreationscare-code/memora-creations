const mongoose = require('mongoose');
const validator = require('validator');

const adminSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true, validate: validator.isEmail },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['admin'], default: 'admin' },
  isActive: { type: Boolean, default: true, index: true },
  lastLoginAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);
