'use strict';

const mongoose = require('mongoose');

/*
  When did this admin last look at a section (orders, returns, ...)?
  The red alert shows only requests that arrived AFTER this time.
*/
const schema = new mongoose.Schema({
  admin: { type: mongoose.Schema.Types.ObjectId, required: true },
  section: { type: String, required: true, maxlength: 30 },
  seenAt: { type: Date, default: Date.now }
});

schema.index({ admin: 1, section: 1 }, { unique: true });

module.exports = mongoose.model('AdminSeen', schema);
