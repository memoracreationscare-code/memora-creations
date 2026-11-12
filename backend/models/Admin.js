const mongoose = require('mongoose');
const validator = require('validator');

const adminSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true, validate: validator.isEmail },
  passwordHash: { type: String, required: true, select: false },
  // 'admin' = owner (everything). 'staff' = helper (packing work only, see middleware/staffGuard.js)
  role: { type: String, enum: ['admin', 'staff'], default: 'admin' },
  isActive: { type: Boolean, default: true, index: true },
  lastLoginAt: { type: Date },

  // 2-step login (authenticator app). Hidden unless asked for with select().
  twoFactor: {
    enabled: { type: Boolean, default: false, select: false },
    secretEnc: { type: String, select: false },
    recoveryHashes: { type: [String], default: undefined, select: false },
    lastStep: { type: Number, select: false }
  }
}, { timestamps: true });

module.exports = mongoose.model('Admin', adminSchema);
