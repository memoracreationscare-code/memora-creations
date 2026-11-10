'use strict';

/*
  One document holding the shop's settings that the owner edits in
  Admin -> Store Settings. A field that was never set stays undefined and
  the value from Render (or the built-in default) is used instead.
*/

const mongoose = require('mongoose');

const str = max => ({ type: String, trim: true, maxlength: max });

const schema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'main' },

  storeOpen: Boolean,
  storeClosedMessage: str(300),

  whatsapp: str(15),
  phone: str(20),
  email: str(120),
  address: str(300),
  instagram: str(200),
  facebook: str(200),
  youtube: str(200),

  deliveryCharge: { type: Number, min: 0, max: 5000 },
  freeDeliveryAbove: { type: Number, min: 0, max: 1000000 },

  codEnabled: Boolean,
  codAdvanceEnabled: Boolean,
  codAdvancePercent: { type: Number, min: 5, max: 90 },

  returnsEnabled: Boolean,
  returnWindowDays: { type: Number, min: 1, max: 60 },

  autoRefundEnabled: Boolean,
  codAutoReceiveDays: { type: Number, min: 0, max: 60 },

  heroKicker: str(60),
  heroLine1: str(60),
  heroHighlight: str(60),
  heroDescription: str(300),
  heroButtonText: str(40),

  freeDeliveryBar: Boolean,

  emailNotificationsEnabled: Boolean,
  emailNotificationsSince: Date,
  abandonedReminderEnabled: Boolean,
  abandonedReminderSince: Date,
  abandonedReminderHours: { type: Number, min: 1, max: 168 }
}, { timestamps: true });

module.exports = mongoose.model('SiteSettings', schema);
