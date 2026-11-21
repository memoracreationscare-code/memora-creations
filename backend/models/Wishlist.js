
const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },

    // Last price we saw for each saved product (productId -> rupees).
    // Used only by the price-drop email; never shown to customers.
    seenPrices: {
      type: Map,
      of: Number,
      default: undefined,
      select: false
    },

    products: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product'
        }
      ],
      default: []
    }
  },
  {
    timestamps: true
  }
);

wishlistSchema.index({
  updatedAt: -1
});

module.exports = mongoose.model(
  'Wishlist',
  wishlistSchema
);
