
/*
=========================================
 MEMORA CREATIONS
 ORDER SERVICE

 COD + CASHFREE + RAZORPAY

 Stock Management
 Trusted Pricing
 Order Creation
 Safe Payment Handling
=========================================
*/

const mongoose = require('mongoose');

const crypto = require('crypto');

const {
  Cart,
  Order,
  Product
} = require('../models');

const {
  error
} = require('../utils/http');

// COUPON_COD_ORDER_SERVICE_V1
const { reserveCoupon } = require('./couponUsageService');


/* =====================================
   ORDER STATUSES
===================================== */

const ORDER_STATUSES = [
  'Order Placed',
  'Confirmed',
  'Packed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
  'Cancelled'
];


/* =====================================
   MONEY
===================================== */

function money(value) {

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    throw error(400, 'Invalid amount.');
  }

  return Math.round(
    (amount + Number.EPSILON) * 100
  ) / 100;

}


/* =====================================
   DELIVERY CHARGE
===================================== */

function deliveryFor(subtotal) {

  const threshold = Number(
    process.env.FREE_DELIVERY_THRESHOLD ?? 499
  );

  const charge = Number(
    process.env.DELIVERY_CHARGE ?? 49
  );

  if (
    !Number.isFinite(threshold) ||
    !Number.isFinite(charge) ||
    threshold < 0 ||
    charge < 0
  ) {

    throw error(
      503,
      'Delivery configuration is invalid.'
    );

  }

  return subtotal >= threshold
    ? 0
    : charge;

}


/* =====================================
   VALIDATE PRODUCTS
===================================== */

async function getTrustedItems(items) {

  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    items.length > 100
  ) {

    throw error(
      400,
      'Please select valid products.'
    );

  }

  const merged = new Map();

  for (const item of items) {

    if (
      !item ||
      typeof item !== 'object'
    ) {

      throw error(
        400,
        'Invalid product details.'
      );

    }

    const productId = String(
      item.productId || item.product || ''
    );

    const quantity = Number(
      item.quantity
    );

    if (
      !mongoose.isValidObjectId(productId) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 99
    ) {

      throw error(
        400,
        'Invalid product or quantity.'
      );

    }

    const previous =
      merged.get(productId) || 0;

    const total =
      previous + quantity;

    if (total > 99) {

      throw error(
        400,
        'Maximum 99 units per product allowed.'
      );

    }

    merged.set(
      productId,
      total
    );

  }

  const ids = [...merged.keys()];

  const products = await Product.find({

    _id: {
      $in: ids
    },

    isActive: true

  })
    .populate('category', 'name')
    .lean();

  if (products.length !== ids.length) {

    throw error(
      400,
      'One or more products are unavailable.'
    );

  }

  const productMap = new Map(

    products.map(product => [

      String(product._id),
      product

    ])

  );

  return ids.map(id => {

    const product = productMap.get(id);

    const quantity = merged.get(id);

    if (!product) {

      throw error(
        404,
        'Product not found.'
      );

    }

    if (
      !Number.isInteger(product.stock) ||
      quantity > product.stock
    ) {

      throw error(
        409,
        `${product.name} does not have enough stock.`
      );

    }

    if (
      !Number.isFinite(Number(product.sellingPrice)) ||
      Number(product.sellingPrice) < 0
    ) {

      throw error(
        409,
        'Product price is invalid.'
      );

    }

    return {
      product,
      quantity
    };

  });

}


/* =====================================
   ORDER TOTALS
===================================== */

function totals(trustedItems) {

  const subtotal = money(

    trustedItems.reduce(
      (sum, item) =>

        sum +
        item.product.sellingPrice *
        item.quantity,

      0
    )

  );

  const original = money(

    trustedItems.reduce(
      (sum, item) =>

        sum +
        (
          Number(
            item.product.originalPrice ??
            item.product.sellingPrice
          )
        ) * item.quantity,

      0
    )

  );

  const discount = money(

    Math.max(
      0,
      original - subtotal
    )

  );

  const deliveryCharge =
    deliveryFor(subtotal);

  return {

    subtotal,

    original,

    discount,

    deliveryCharge,

    grandTotal: money(
      subtotal + deliveryCharge
    )

  };

}


/* =====================================
   UNIQUE ORDER NUMBER
===================================== */

function createOrderNumber() {

  const year = new Date().getFullYear();

  const suffix = crypto
    .randomBytes(5)
    .toString('hex')
    .toUpperCase();

  return `MC-${year}-${suffix}`;

}


/* =====================================
   BUILD ORDER DOCUMENT
===================================== */

async function buildOrderDocument({

  user,
  address,
  items,
  paymentMethod,
  razorpayOrderId,
  cashfreeOrderId,
  couponCode = null,
  clearCartOnPayment = false,
  session

}) {

  const allowedMethods = [
    'COD',
    'RAZORPAY',
    'CASHFREE'
  ];

  if (
    !allowedMethods.includes(paymentMethod)
  ) {

    throw error(
      400,
      'Invalid payment method.'
    );

  }

  if (
    paymentMethod === 'CASHFREE' &&
    !cashfreeOrderId
  ) {

    throw error(
      400,
      'Cashfree order reference required.'
    );

  }

  if (
    paymentMethod === 'RAZORPAY' &&
    !razorpayOrderId
  ) {

    throw error(
      400,
      'Razorpay order reference required.'
    );

  }

  const trusted = await getTrustedItems(
    items
  );

  const amount = totals(trusted);

  // Reserve coupon atomically together with the local order.
  // No coupon? All legacy pricing remains unchanged.
  const couponReservation = couponCode
    ? await reserveCoupon({
        code: couponCode,
        subtotal: amount.subtotal,
        userId: user._id,
        session
      })
    : null;

  const appliedCouponDiscount =
    couponReservation ? money(couponReservation.couponDiscount) : 0;

  const payableTotal = money(
    Math.max(0, amount.grandTotal - appliedCouponDiscount)
  );

  const orderItems = trusted.map(
    ({ product, quantity }) => ({

      product: product._id,

      productId: product.productId,

      name: product.name,

      imageUrl:
        product.images?.[0]?.url || '',

      quantity,

      unitPrice:
        product.sellingPrice,

      lineTotal: money(
        product.sellingPrice * quantity
      )

    })
  );

  const paymentStatus =
    paymentMethod === 'COD'
      ? 'COD_PENDING'
      : 'PENDING';

  return new Order({

    orderId: createOrderNumber(),

    user: user._id,

    customer: {

      fullName:
        user.fullName || address.fullName,

      mobile:
        user.mobile || address.mobile,

      email:
        user.email || undefined

    },

    shippingAddress: address,

    items: orderItems,

    subtotal:
      amount.subtotal,

    deliveryCharge:
      amount.deliveryCharge,

    discount:
      amount.discount,

    coupon:
      couponReservation?.couponId || null,

    couponCode:
      couponReservation?.couponCode || null,

    couponDiscount:
      appliedCouponDiscount,

    couponUsageReserved:
      Boolean(couponReservation),

    grandTotal:
      payableTotal,

    paymentMethod,

    paymentStatus,

    razorpayOrderId,

    cashfreeOrderId,

    clearCartOnPayment:
      paymentMethod !== 'COD' &&
      clearCartOnPayment === true,

    stockReserved: false,

    orderStatus:
      'Order Placed',

    statusHistory: [{

      status:
        'Order Placed',

      note:
        'Order created.',

      changedAt:
        new Date()

    }]

  });

}


/* =====================================
   RESERVE STOCK

   Must run inside MongoDB transaction.
===================================== */

async function reserveStock(order, session) {

  if (!session) {

    throw error(
      500,
      'Stock transaction required.'
    );

  }

  if (!order) {

    throw error(
      400,
      'Order is required.'
    );

  }

  if (order.stockReserved === true) {

    throw error(
      409,
      'Stock already reserved.'
    );

  }

  for (const item of order.items) {

    const updated = await Product.findOneAndUpdate(

      {

        _id: item.product,

        isActive: true,

        stock: {
          $gte: item.quantity
        }

      },

      {

        $inc: {
          stock: -item.quantity
        }

      },

      {

        new: true,

        session

      }

    );

    if (!updated) {

      throw error(
        409,
        `${item.name} went out of stock. Please retry.`
      );

    }

  }

  order.stockReserved = true;

}


/* =====================================
   RELEASE STOCK

   Only call from a transaction that
   has already established the order
   is safe to cancel/release.
===================================== */

async function releaseStock(order, session) {

  if (!session) {

    throw error(
      500,
      'Stock release transaction required.'
    );

  }

  if (
    !order ||
    order.stockReserved !== true
  ) {

    return;

  }

  for (const item of order.items) {

    const result = await Product.updateOne(

      {
        _id: item.product
      },

      {
        $inc: {
          stock: item.quantity
        }
      },

      {
        session
      }

    );

    if (result.matchedCount !== 1) {

      throw error(
        409,
        'Product not found during stock release.'
      );

    }

  }

  order.stockReserved = false;

}


/* =====================================
   CREATE COD ORDER
===================================== */

async function createCodOrder({

  user,
  address,
  items,
  couponCode = null,
  clearCart = false

}) {

  const session = await mongoose.startSession();

  let order;

  try {

    await session.withTransaction(async () => {

      order = await buildOrderDocument({

        user,

        address,

        items,

        paymentMethod: 'COD',

        couponCode,

        session

      });

      await reserveStock(
        order,
        session
      );

      await order.save({
        session
      });

      if (clearCart === true) {

        await Cart.updateOne(

          {
            user: user._id
          },

          {
            $set: {
              items: []
            }
          },

          {
            session
          }

        );

      }

    });

    return order;

  } finally {

    await session.endSession();

  }

}


/* =====================================
   CREATE RAZORPAY PENDING ORDER

   Legacy flow preserved.
===================================== */

async function createOnlinePendingOrder({

  user,
  address,
  items,
  razorpayOrderId,
  clearCart = false

}) {

  const session = await mongoose.startSession();

  let order;

  try {

    await session.withTransaction(async () => {

      order = await buildOrderDocument({

        user,

        address,

        items,

        paymentMethod:
          'RAZORPAY',

        razorpayOrderId,

        clearCartOnPayment:
          clearCart,

        session

      });

      await reserveStock(
        order,
        session
      );

      await order.save({
        session
      });

    });

    return order;

  } finally {

    await session.endSession();

  }

}


/* =====================================
   CREATE CASHFREE PENDING ORDER
===================================== */

async function createCashfreePendingOrder({

  user,
  address,
  items,
  cashfreeOrderId,
  // MC_CASHFREE_COUPON_PASS_V1
  couponCode = null,
  clearCart = false

}) {

  if (!cashfreeOrderId) {

    throw error(
      400,
      'Cashfree order ID required.'
    );

  }

  const session = await mongoose.startSession();

  let order;

  try {

    await session.withTransaction(async () => {

      order = await buildOrderDocument({

        user,

        address,

        items,

        paymentMethod:
          'CASHFREE',

        cashfreeOrderId,

        couponCode,

        clearCartOnPayment:
          clearCart,

        session

      });

      await reserveStock(
        order,
        session
      );

      await order.save({
        session
      });

    });

    return order;

  } finally {

    await session.endSession();

  }

}


/* =====================================
   CANCEL PENDING ONLINE ORDER

   IMPORTANT SECURITY GUARD

   Do not automatically release stock
   only because the payment appears
   PENDING or FAILED in our database.

   Cashfree/Razorpay payment events can
   arrive late.

   A separate gateway-aware expiry and
   reconciliation workflow is required.

   This function deliberately leaves
   online orders unchanged until that
   workflow has been implemented.
===================================== */

async function cancelPendingOnlineOrder(order) {

  if (!order) {
    return order;
  }

  if (
    ![
      'RAZORPAY',
      'CASHFREE'
    ].includes(order.paymentMethod)
  ) {

    return order;

  }

  if (
    order.paymentStatus === 'SUCCESS' ||
    order.orderStatus === 'Cancelled'
  ) {

    return order;

  }

  console.warn(
    'Online order cleanup deferred:',
    String(order._id),
    'Gateway reconciliation required.'
  );

  return order;

}


/* =====================================
   EXPORTS
===================================== */

module.exports = {

  ORDER_STATUSES,

  getTrustedItems,

  totals,

  buildOrderDocument,

  createCodOrder,

  createOnlinePendingOrder,

  createCashfreePendingOrder,

  cancelPendingOnlineOrder,

  reserveStock,

  releaseStock,

  deliveryFor,

  money

};
