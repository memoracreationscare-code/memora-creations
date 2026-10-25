
const mongoose = require('mongoose');

const siteAnnouncementSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'homepage'
    },

    enabled: {
      type: Boolean,
      default: false
    },

    title: {
      type: String,
      trim: true,
      maxlength: 120,
      default: 'Welcome to Memora Creations'
    },

    message: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ''
    },

    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    versionKey: false
  }
);

module.exports =
  mongoose.models.SiteAnnouncement ||
  mongoose.model(
    'SiteAnnouncement',
    siteAnnouncementSchema
  );
