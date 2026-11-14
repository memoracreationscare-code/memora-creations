
/*
====================================
 MEMORA CREATIONS
 DATABASE MODELS

 SHIPROCKET TRACKING SUPPORT
====================================
*/

module.exports = {

  User: require('./User'),

  Admin: require('./Admin'),

  ActivityLog: require('./ActivityLog'),

  Category: require('./Category'),

  Product: require('./Product'),

  Cart: require('./Cart'),

  Order: require('./Order'),

  // SHIPROCKET SHIPMENT TRACKING
  ShipmentTracking: require('./ShipmentTracking'),

  // PRODUCT REVIEWS & RATINGS
  Review: require('./Review'),

  // BACK-IN-STOCK REQUESTS
  StockAlert: require('./StockAlert'),

  Wishlist: require('./Wishlist'),

  WishlistSettings: require('./WishlistSettings'),

  Coupon: require('./Coupon'),

  AdminSeen: require('./AdminSeen'),

  CouponUserUsage: require('./CouponUserUsage'),

  // WHATSAPP ORDER NOTIFICATIONS
  WhatsAppNotification: require('./WhatsAppNotification')

};
