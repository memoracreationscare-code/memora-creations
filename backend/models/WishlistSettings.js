
const mongoose = require('mongoose');

const wishlistSettingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'wishlist',
      unique: true,
      immutable: true
    },

    enabled: {
      type: Boolean,
      default: true
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  'WishlistSettings',
  wishlistSettingsSchema
);
