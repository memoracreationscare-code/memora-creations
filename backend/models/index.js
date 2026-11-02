
/*
====================================
 MEMORA CREATIONS
 DATABASE MODELS
====================================
*/

module.exports = {

  User: require('./User'),

  Admin: require('./Admin'),

  Category: require('./Category'),

  Product: require('./Product'),

  Cart: require('./Cart'),

  Order: require('./Order'),

  // PRODUCT REVIEWS & RATINGS
  Review: require('./Review'),

  Wishlist: require('./Wishlist'),

  WishlistSettings: require('./WishlistSettings'),

  Coupon: require('./Coupon'),

  CouponUserUsage: require('./CouponUserUsage'),

  // WHATSAPP ORDER NOTIFICATIONS
  WhatsAppNotification: require('./WhatsAppNotification')

};
