'use strict';

const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  imageUrl: { type: String, required: true, trim: true, maxlength: 500 },
  mobileImageUrl: { type: String, trim: true, maxlength: 500, default: '' },
  title: { type: String, trim: true, maxlength: 80, default: '' },
  subtitle: { type: String, trim: true, maxlength: 160, default: '' },
  buttonText: { type: String, trim: true, maxlength: 30, default: '' },
  link: { type: String, trim: true, maxlength: 300, default: '' },
  sortOrder: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  startsAt: Date,
  endsAt: Date
}, { timestamps: true });

module.exports = mongoose.model('Banner', schema);
