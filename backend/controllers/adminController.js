
/*
=========================================
 MEMORA CREATIONS
 ADMIN CONTROLLER

 ADMIN LOGIN / LOGOUT
 DASHBOARD
 PRODUCTS + SHIPPING DETAILS
 CATEGORIES
 ORDERS
 USERS

 PAYMENT-CONFIRMED REVENUE
=========================================
*/

const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { cleanVariants } = require('../utils/variants');

const {
  Admin,
  User,
  Product,
  Category,
  Order
} = require('../models');

const {
  asyncHandler,
  error,
  ok
} = require('../utils/http');

const {
  setAuthCookie,
  clearAuthCookie
} = require('../middleware/auth');

const {
  cleanString,
  validEmail,
  nonNegativeNumber
} = require('../utils/validation');

const {
  slugify
} = require('./productController');

const {
  releaseStock
} = require('../services/orderService');

const {
  releaseCoupon
} = require('../services/couponUsageService');


/* =====================================
   OPTIONAL SHIPPING DETAILS
===================================== */

const SHIPPING_FIELDS = {
  shippingWeightKg: {
    min: 0.001,
    max: 100
  },
  packageLengthCm: {
    min: 0.1,
    max: 1000
  },
  packageWidthCm: {
    min: 0.1,
    max: 1000
  },
  packageHeightCm: {
    min: 0.1,
    max: 1000
  }
};

function readShippingDetails(body) {
  const details = {};

  for (const [key, range] of Object.entries(
    SHIPPING_FIELDS
  )) {
    if (
      !Object.prototype.hasOwnProperty.call(
        body,
        key
      )
    ) {
      continue;
    }

    const raw = body[key];

    if (
      raw === null ||
      raw === undefined ||
      raw === ''
    ) {
      details[key] = undefined;
      continue;
    }

    if (
      typeof raw !== 'string' &&
      typeof raw !== 'number'
    ) {
      throw error(
        400,
        `Invalid ${key}.`
      );
    }

    if (
      typeof raw === 'string' &&
      raw.trim() === ''
    ) {
      details[key] = undefined;
      continue;
    }

    const value = Number(raw);

    if (
      !Number.isFinite(value) ||
      value < range.min ||
      value > range.max
    ) {
      throw error(
        400,
        `Invalid ${key}.`
      );
    }

    details[key] = value;
  }

  return details;
}


/* =====================================
   ADMIN LOGIN
===================================== */

const login = asyncHandler(async (req, res) => {

  const email = cleanString(
    req.body.email,
    150
  ).toLowerCase();

  const password = String(
    req.body.password || ''
  );

  if (!validEmail(email) || !password) {
    throw error(
      400,
      'Valid admin email and password are required.'
    );
  }

  const admin = await Admin.findOne({
    email
  }).select('+passwordHash +twoFactor.enabled +twoFactor.secretEnc +twoFactor.recoveryHashes +twoFactor.lastStep');

  if (
    !admin ||
    !admin.isActive ||
    !(await bcrypt.compare(
      password,
      admin.passwordHash
    ))
  ) {
    throw error(
      401,
      'Invalid admin credentials.'
    );
  }

  // 2-step login: password was right, now ask for the authenticator code.
  // Set ADMIN_2FA_DISABLE=true on Render to get back in if the phone is lost.
  if (
    admin.twoFactor?.enabled &&
    process.env.ADMIN_2FA_DISABLE !== 'true'
  ) {

    const otp = String(req.body.otp || '').trim();

    if (!otp) {
      return ok(res, {
        requiresOtp: true,
        message: 'Authenticator app ka 6 digit code daalein.'
      });
    }

    const twoFactor = require('../services/adminTwoFactor');

    if (!(await twoFactor.verifyLogin(Admin, admin, otp))) {
      throw error(
        401,
        'Code galat hai. Dobara try karein (ya recovery code daalein).'
      );
    }

  }

  admin.lastLoginAt = new Date();

  await Admin.updateOne(
    { _id: admin._id },
    { $set: { lastLoginAt: admin.lastLoginAt } }
  );

  setAuthCookie(res, {
    sub: String(admin._id),
    type: 'admin'
  });

  return ok(res, {
    message: 'Admin login successful.',
    admin: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role
    }
  });

});


/* =====================================
   ADMIN LOGOUT
===================================== */

const logout = asyncHandler(async (_req, res) => {

  clearAuthCookie(
    res,
    'admin'
  );

  return ok(res, {
    message: 'Admin logged out successfully.'
  });

});


/* =====================================
   ADMIN DASHBOARD

   Only SUCCESS payments count as sales.
===================================== */

const dashboard = asyncHandler(async (_req, res) => {

  const start = new Date();

  start.setHours(0, 0, 0, 0);

  const [
    totalOrders,
    todayOrders,
    sales,
    onlinePayments,
    codOrders,
    pendingOrders,
    deliveredOrders,
    cancelledOrders,
    totalProducts,
    lowStockProducts,
    totalCustomers
  ] = await Promise.all([

    Order.countDocuments(),

    Order.countDocuments({
      createdAt: {
        $gte: start
      }
    }),

    Order.aggregate([
      {
        $match: {
          paymentStatus: 'SUCCESS',
          orderStatus: {
            $ne: 'Cancelled'
          }
        }
      },
      {
        $group: {
          _id: null,
          total: {
            $sum: '$grandTotal'
          }
        }
      }
    ]),

    Order.countDocuments({
      paymentMethod: {
        $in: [
          'CASHFREE',
          'RAZORPAY'
        ]
      },
      paymentStatus: 'SUCCESS',
      orderStatus: {
        $ne: 'Cancelled'
      }
    }),

    Order.countDocuments({
      paymentMethod: 'COD'
    }),

    Order.countDocuments({
      orderStatus: {
        $nin: [
          'Delivered',
          'Cancelled'
        ]
      }
    }),

    Order.countDocuments({
      orderStatus: 'Delivered'
    }),

    Order.countDocuments({
      orderStatus: 'Cancelled'
    }),

    Product.countDocuments({
      isActive: true
    }),

    Product.countDocuments({
      isActive: true,
      stock: {
        $lte: 5
      }
    }),

    User.countDocuments({
      isActive: true
    })

  ]);

  return ok(res, {
    dashboard: {
      totalOrders,
      todayOrders,
      totalSales: sales[0]?.total || 0,
      onlinePayments,
      codOrders,
      pendingOrders,
      deliveredOrders,
      cancelledOrders,
      totalProducts,
      lowStockProducts,
      totalCustomers
    }
  });

});


/* =====================================
   LIST PRODUCTS
===================================== */

const listProducts = asyncHandler(async (_req, res) => {

  const products = await Product.find()
    .populate('category', 'name')
    .sort({
      createdAt: -1
    })
    .lean();

  const categories = await Category.find()
    .sort({
      name: 1
    })
    .lean();

  return ok(res, {
    products,
    categories
  });

});


/* =====================================
   CREATE PRODUCT
===================================== */

function readVariants(body) {
  try {
    const variants = cleanVariants(body.variants);
    return variants === undefined ? {} : { variants };
  } catch (e) {
    throw error(400, e.message);
  }
}

const createProduct = asyncHandler(async (req, res) => {

  const b = req.body;

  // Say exactly which field is wrong, so the owner can fix it at once.
  const problem =
    !cleanString(b.name, 180)
      ? 'Product name is required.'
      : !cleanString(b.description, 5000)
        ? 'Product description is required.'
        : !b.category
          ? 'Please choose a category (add one first if the list is empty).'
          : !nonNegativeNumber(b.originalPrice)
            ? 'Original price (MRP) must be a number.'
            : !nonNegativeNumber(b.sellingPrice)
              ? 'Selling price must be a number.'
              : Number(b.sellingPrice) > Number(b.originalPrice)
                ? 'Selling price cannot be more than the original price (MRP).'
                : (!Number.isInteger(Number(b.stock)) || Number(b.stock) < 0)
                  ? 'Stock must be a whole number (0 or more).'
                  : '';

  if (problem) {
    throw error(400, problem);
  }

  const slug = slugify(b.name);

  if (!slug) {
    throw error(
      400,
      'Product name must contain letters or numbers.'
    );
  }

  if (await Product.findOne({ slug })) {
    throw error(
      409,
      'A product with this name already exists.'
    );
  }

  if (
    !mongoose.isValidObjectId(b.category) ||
    !(await Category.findOne({
      _id: b.category,
      isActive: true
    }))
  ) {
    throw error(
      400,
      'Valid active category is required.'
    );
  }

  const shippingDetails =
    readShippingDetails(b);

  const productId =
    `MC-P-${Date.now()
      .toString(36)
      .toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 7)
      .toUpperCase()}`;

  const product = await Product.create({

    productId,

    name: cleanString(
      b.name,
      180
    ),

    slug,

    description: cleanString(
      b.description,
      5000
    ),

    keywords: Array.isArray(b.keywords)
      ? b.keywords
          .map(item =>
            cleanString(item, 50).toLowerCase()
          )
          .filter(Boolean)
      : [],

    images: Array.isArray(b.images)
      ? b.images.slice(0, 8)
      : [],

    category: b.category,

    originalPrice: Number(
      b.originalPrice
    ),

    sellingPrice: Number(
      b.sellingPrice
    ),

    stock: Number(b.stock),

    ...readVariants(b),

    ...shippingDetails,

    isFeatured: Boolean(
      b.isFeatured
    ),

    isNewArrival:
      b.isNewArrival !== false,

    isBestSeller: Boolean(
      b.isBestSeller
    ),

    isActive:
      b.isActive !== false

  });

  return ok(res, {
    product
  }, 201);

});


/* =====================================
   UPDATE PRODUCT
===================================== */

const updateProduct = asyncHandler(async (req, res) => {

  const product = await Product.findById(
    req.params.id
  );

  if (!product) {
    throw error(
      404,
      'Product not found.'
    );
  }

  const body = req.body;

  [
    'name',
    'description',
    'category',
    'originalPrice',
    'sellingPrice',
    'stock',
    'isFeatured',
    'isNewArrival',
    'isBestSeller',
    'isActive',
    'images',
    'keywords'
  ].forEach(key => {

    if (body[key] !== undefined) {
      product[key] = body[key];
    }

  });

  if (body.variants !== undefined) {
    product.variants = readVariants(body).variants;
  }

  const shippingDetails =
    readShippingDetails(body);

  for (const [key, value] of Object.entries(
    shippingDetails
  )) {
    product[key] = value;
  }

  if (body.name !== undefined) {

    const slug = slugify(body.name);

    if (!slug) {
      throw error(
        400,
        'Invalid product name.'
      );
    }

    const duplicate = await Product.findOne({
      slug,
      _id: {
        $ne: product._id
      }
    });

    if (duplicate) {
      throw error(
        409,
        'A product with this name already exists.'
      );
    }

    product.slug = slug;
  }

  if (body.category !== undefined) {

    if (
      !mongoose.isValidObjectId(body.category) ||
      !(await Category.findOne({
        _id: body.category,
        isActive: true
      }))
    ) {
      throw error(
        400,
        'Valid active category is required.'
      );
    }

  }

  if (
    product.sellingPrice > product.originalPrice ||
    product.stock < 0
  ) {
    throw error(
      400,
      'Invalid price or stock.'
    );
  }

  await product.save();

  return ok(res, {
    product
  });

});


/* =====================================
   DELETE PRODUCT
===================================== */

const deleteProduct = asyncHandler(async (req, res) => {

  const product = await Product.findById(
    req.params.id
  );

  if (!product) {
    throw error(
      404,
      'Product not found.'
    );
  }

  product.isActive = false;

  await product.save();

  return ok(res, {
    message: 'Product disabled.'
  });

});


/* =====================================
   CREATE CATEGORY
===================================== */

const createCategory = asyncHandler(async (req, res) => {

  const name = cleanString(
    req.body.name,
    80
  );

  const slug = slugify(name);

  if (name.length < 2 || !slug) {
    throw error(
      400,
      'Category name is required.'
    );
  }

  if (
    await Category.findOne({
      $or: [
        { name },
        { slug }
      ]
    })
  ) {
    throw error(
      409,
      'Category already exists.'
    );
  }

  const category = await Category.create({

    name,
    slug,

    description: cleanString(
      req.body.description,
      500
    ),

    imageUrl: cleanString(
      req.body.imageUrl,
      500
    )

  });

  return ok(res, {
    category
  }, 201);

});


/* =====================================
   UPDATE CATEGORY
===================================== */

const updateCategory = asyncHandler(async (req, res) => {

  const category = await Category.findById(
    req.params.id
  );

  if (!category) {
    throw error(
      404,
      'Category not found.'
    );
  }

  const name = cleanString(
    req.body.name,
    80
  );

  const slug = slugify(name);

  if (name.length < 2 || !slug) {
    throw error(
      400,
      'Category name is required.'
    );
  }

  if (
    await Category.findOne({
      $or: [
        { name },
        { slug }
      ],
      _id: {
        $ne: category._id
      }
    })
  ) {
    throw error(
      409,
      'Category already exists.'
    );
  }

  category.name = name;
  category.slug = slug;

  category.description = cleanString(
    req.body.description,
    500
  );

  category.imageUrl = cleanString(
    req.body.imageUrl,
    500
  );

  await category.save();

  return ok(res, {
    category
  });

});


/* =====================================
   DELETE CATEGORY
===================================== */

const deleteCategory = asyncHandler(async (req, res) => {

  const category = await Category.findById(
    req.params.id
  );

  if (!category) {
    throw error(
      404,
      'Category not found.'
    );
  }

  category.isActive = false;

  await category.save();

  return ok(res, {
    message: 'Category disabled.'
  });

});


// Treat the search text as plain text, not as a regular expression.
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* =====================================
   LIST ORDERS
===================================== */

const listOrders = asyncHandler(async (req, res) => {

  const filter = {};

  if (req.query.search) {

    // Order ID, customer name, mobile or email.
    const pattern = {
      $regex: escapeRegex(
        cleanString(
          req.query.search,
          50
        )
      ),
      $options: 'i'
    };

    filter.$or = [
      { orderId: pattern },
      { 'customer.fullName': pattern },
      { 'customer.mobile': pattern },
      { 'customer.email': pattern },
      { 'shippingAddress.fullName': pattern },
      { 'shippingAddress.mobile': pattern }
    ];

  }

  // Optional status filter: one or more statuses, comma separated.
  if (req.query.status) {

    const wanted = String(req.query.status)
      .split(',')
      .map(x => cleanString(x, 40))
      .filter(Boolean)
      .slice(0, 12);

    if (wanted.length) {
      filter.orderStatus = { $in: wanted };
    }

  }

  const orders = await Order.find(filter)
    .populate(
      'user',
      'fullName mobile email'
    )
    .sort({
      createdAt: -1
    })
    .limit(200)
    .lean();

  return ok(res, {
    orders
  });

});


/* =====================================
   UPDATE ORDER
===================================== */

const updateOrder = asyncHandler(async (req, res) => {

  const status = req.body.orderStatus;

  const allowed = [
    'Order Placed',
    'Confirmed',
    'Packed',
    'Shipped',
    'Out for Delivery',
    'Delivered',
    'Cancelled'
  ];

  if (!allowed.includes(status)) {
    throw error(
      400,
      'Invalid order status.'
    );
  }

  if (!mongoose.isValidObjectId(req.params.id)) {
    throw error(
      400,
      'Invalid order ID.'
    );
  }

  const session = await mongoose.startSession();

  let order;

  try {

    await session.withTransaction(async () => {

      order = await Order.findById(
        req.params.id
      ).session(session);

      if (!order) {
        throw error(
          404,
          'Order not found.'
        );
      }

      if (order.orderStatus === 'Cancelled') {

        if (status !== 'Cancelled') {
          throw error(
            400,
            'Cancelled order cannot be reopened.'
          );
        }

        return;
      }

      if (
        status === 'Cancelled' &&
        order.orderStatus === 'Delivered'
      ) {
        throw error(
          400,
          'Delivered orders cannot be cancelled.'
        );
      }

      /*
       Online orders require separate
       payment reconciliation/refund flow.
      */

      if (
        status === 'Cancelled' &&
        (
          order.paymentMethod === 'CASHFREE' ||
          order.paymentMethod === 'RAZORPAY'
        )
      ) {
        throw error(
          409,
          'Online orders require payment reconciliation and support-assisted cancellation.'
        );
      }

      if (
        status === 'Cancelled' &&
        order.paymentMethod === 'COD' &&
        order.paymentStatus !== 'COD_PENDING'
      ) {
        throw error(
          409,
          'COD payment requires manual review.'
        );
      }

      if (status === 'Cancelled') {

        await releaseStock(
          order,
          session
        );

        // MC_ADMIN_COD_COUPON_RELEASE_V1
        // Release reserved coupon once,
        // inside the order transaction.
        if (
          order.paymentMethod === 'COD' &&
          order.couponUsageReserved === true
        ) {
          if (!order.coupon) {
            throw error(
              409,
              'Order coupon reservation is incomplete.'
            );
          }

          await releaseCoupon({
            couponId: order.coupon,
            userId: order.user,
            session
          });

          order.couponUsageReserved = false;
        }

        if (order.paymentMethod === 'COD') {
          order.paymentStatus = 'CANCELLED';
        }

      }

      order.orderStatus = status;

      order.statusHistory.push({

        status,

        note: cleanString(
          req.body.note,
          300
        ) || 'Status updated by admin.',

        changedAt: new Date()

      });

      await order.save({
        session
      });

    });

  } finally {

    await session.endSession();

  }

  return ok(res, {
    order
  });

});


/* =====================================
   LIST USERS
===================================== */

const listUsers = asyncHandler(async (_req, res) => {

  const users = await User.find()
    .select(
      '-passwordHash -passwordResetTokenHash -passwordResetExpiresAt -avatar'
    )
    .sort({
      passwordResetRequestedAt: -1,
      createdAt: -1
    })
    .limit(500)
    .lean();

  return ok(res, {
    users
  });

});


/* =====================================
   USER ORDERS
===================================== */

const userOrders = asyncHandler(async (req, res) => {

  if (!mongoose.isValidObjectId(req.params.id)) {
    throw error(
      400,
      'Invalid user id.'
    );
  }

  const orders = await Order.find({
    user: req.params.id
  })
    .sort({
      createdAt: -1
    })
    .lean();

  return ok(res, {
    orders
  });

});


/* =====================================
   ENABLE / DISABLE USER
===================================== */

const toggleUser = asyncHandler(async (req, res) => {

  const user = await User.findById(
    req.params.id
  );

  if (!user) {
    throw error(
      404,
      'User not found.'
    );
  }

  user.isActive = !user.isActive;

  await user.save();

  return ok(res, {
    user
  });

});


/* =====================================
   ADMIN RESET USER PASSWORD
===================================== */

const resetUserPassword = asyncHandler(async (req, res) => {

  if (!mongoose.isValidObjectId(req.params.id)) {
    throw error(
      400,
      'Invalid customer id.'
    );
  }

  const password = String(
    req.body.password || ''
  );

  if (password.length < 8) {
    throw error(
      400,
      'Password minimum 8 characters ka hona chahiye.'
    );
  }

  if (password.length > 100) {
    throw error(
      400,
      'Password bahut lamba hai.'
    );
  }

  const user = await User.findById(
    req.params.id
  ).select(
    '+passwordHash +passwordResetTokenHash +passwordResetExpiresAt'
  );

  if (!user) {
    throw error(
      404,
      'Customer not found.'
    );
  }

  user.passwordHash = await bcrypt.hash(
    password,
    12
  );

  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  user.passwordResetRequestedAt = null;

  await user.save();

  return ok(res, {
    message:
      'Customer password updated successfully.'
  });

});


/* =====================================
   EXPORTS
===================================== */

/* =====================================
   REFRESH ONLINE PAYMENT DETAILS

   POST /api/admin/orders/:id/refresh-payment

   Reads the payment from Cashfree and saves
   UPI ID / UTR / method. Read-only on Cashfree;
   never changes payment or order status.
===================================== */

const refreshPaymentDetails = asyncHandler(async (req, res) => {

  const order = await Order.findById(req.params.id);

  if (!order || order.paymentMethod !== 'CASHFREE' || !order.cashfreeOrderId) {
    throw error(404, 'Online payment order not found.');
  }

  const util = require('../utils/paymentDetails');
  const { fetchCashfreePayments } =
    require('../services/cashfreeService');

  const payment = util.pickSuccessfulPayment(
    await fetchCashfreePayments(order.cashfreeOrderId)
  );

  if (!payment) {
    throw error(404, 'No successful payment found in Cashfree for this order yet.');
  }

  const details = util.extractPaymentDetails(payment);

  await Order.updateOne(
    { _id: order._id },
    { $set: { paymentDetails: details } }
  );

  return ok(res, { paymentDetails: details });
});


module.exports = {
  refreshPaymentDetails,

  login,
  logout,
  dashboard,

  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,

  createCategory,
  updateCategory,
  deleteCategory,

  listOrders,
  updateOrder,

  listUsers,
  userOrders,
  toggleUser,
  resetUserPassword

};
