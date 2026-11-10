'use strict';

const mongoose = require('mongoose');

/* One line per change made in the admin panel ("who did what, when"). */

const activityLogSchema = new mongoose.Schema({
  admin: { type: String, trim: true, maxlength: 120 },
  action: { type: String, required: true, trim: true, maxlength: 120 },
  method: { type: String, trim: true, maxlength: 10 },
  path: { type: String, trim: true, maxlength: 200 },
  targetId: { type: String, trim: true, maxlength: 60 },
  ip: { type: String, trim: true, maxlength: 60 },
  at: { type: Date, default: Date.now, index: true }
}, { versionKey: false });

// keep six months of history
activityLogSchema.index({ at: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
