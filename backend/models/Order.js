
const mongoose = require('mongoose');

/* =========================================
   MEMORA CREATIONS
   ORDER MODEL
   RAZORPAY + CASHFREE + COD
========================================= */

const orderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },

  productId: {
    type: String,
    required: true
  },

  name: {
    type: String,
    required: true,
    trim: true
  },

  imageUrl: {
    type: String,
    trim: true
  },

  quantity: {
    type: Number,
    required: true,
    min: 1
  },

  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },

  lineTotal: {
    type: Number,
    required: true,
    min: 0
  }
}, {
  _id: false
});


/* =========================================
   SHIPPING ADDRESS
========================================= */

const shippingAddressSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true
  },

  mobile: {
    type: String,
    required: true,
    match: /^[6-9]\d{9}$/
  },

  addressLine: {
    type: String,
    required: true,
    trim: true
  },

  pinCode: {
    type: String,
    required: true,
    match: /^\d{6}$/
  },

  city: {
    type: String,
    trim: true
  },

  state: {
    type: String,
    trim: true
  }
}, {
  _id: false
});


/* =========================================
   MAIN ORDER SCHEMA
========================================= */

const orderSchema = new mongoose.Schema({

  orderId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  customer: {
    fullName: {
      type: String,
      required: true,
      trim: true
    },

    mobile: {
      type: String,
      required: true,
      match: /^[6-9]\d{9}$/
    },

    email: {
      type: String,
      trim: true,
      lowercase: true
    }
  },

  shippingAddress: {
    type: shippingAddressSchema,
    required: true
  },

  items: {
    type: [orderItemSchema],
    required: true,
    validate: v => v.length > 0
  },

  subtotal: {
    type: Number,
    required: true,
    min: 0
  },

  deliveryCharge: {
    type: Number,
    required: true,
    min: 0
  },

  discount: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },

  // Applied coupon details (optional for existing orders)
  coupon: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon',
    default: null
  },

  couponCode: {
    type: String,
    trim: true,
    uppercase: true,
    default: null,
    maxlength: 30
  },

  // Coupon discount is recorded in the existing discount field.
  // Coupon usage will be handled by the order/payment integration.

  grandTotal: {
    type: Number,
    required: true,
    min: 0
  },

  /* =====================================
     PAYMENT METHOD
     CASHFREE ADDED
  ===================================== */

  paymentMethod: {
    type: String,
    enum: [
      'RAZORPAY',
      'CASHFREE',
      'COD'
    ],
    required: true,
    index: true
  },

  stockReserved: {
    type: Boolean,
    default: false,
    index: true
  },

  clearCartOnPayment: {
    type: Boolean,
    default: false
  },

  paymentStatus: {
    type: String,
    enum: [
      'PENDING',
      'SUCCESS',
      'FAILED',
      'CANCELLED',
      'COD_PENDING'
    ],
    default: 'PENDING',
    index: true
  },

  /* =====================================
     EXISTING RAZORPAY FIELDS
     PRESERVED FOR OLD ORDERS
  ===================================== */

  razorpayOrderId: {
    type: String,
    sparse: true,
    index: true
  },

  razorpayPaymentId: {
    type: String,
    sparse: true
  },

  razorpayEventId: {
    type: String,
    sparse: true,
    unique: true
  },

  /* =====================================
     NEW CASHFREE FIELDS
  ===================================== */

  cashfreeOrderId: {
    type: String,
    sparse: true,
    index: true
  },

  cashfreeCfOrderId: {
    type: String
  },

  cashfreePaymentId: {
    type: String
  },

  cashfreeEventId: {
    type: String,
    sparse: true
  },

  /* =====================================
     ORDER STATUS
  ===================================== */

  orderStatus: {
    type: String,
    enum: [
      'Order Placed',
      'Confirmed',
      'Packed',
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Cancelled'
    ],
    default: 'Order Placed',
    index: true
  },

  statusHistory: [{
    status: {
      type: String,
      enum: [
        'Order Placed',
        'Confirmed',
        'Packed',
        'Shipped',
        'Out for Delivery',
        'Delivered',
        'Cancelled'
      ]
    },

    note: {
      type: String,
      trim: true,
      maxlength: 300
    },

    changedAt: {
      type: Date,
      default: Date.now
    }
  }]

}, {
  timestamps: true
});


/* =========================================
   DATABASE INDEXES
========================================= */

orderSchema.index({
  user: 1,
  createdAt: -1
});

orderSchema.index({
  createdAt: -1
});

orderSchema.index({
  paymentMethod: 1,
  paymentStatus: 1
});


/* =========================================
   EXPORT
========================================= */

module.exports = mongoose.model(
  'Order',
  orderSchema
);
