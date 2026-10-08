const bcrypt =
  require('bcryptjs');

const {
  Admin,
  User,
  Product,
  Category,
  Order
} =
  require('../models');

const {
  asyncHandler,
  error,
  ok
} =
  require('../utils/http');

const {
  setAuthCookie,
  clearAuthCookie
} =
  require('../middleware/auth');

const {
  cleanString,
  validEmail,
  nonNegativeNumber
} =
  require('../utils/validation');

const {
  slugify
} =
  require('./productController');

const mongoose =
  require('mongoose');

const {
  releaseStock
} =
  require('../services/orderService');


/* =========================
   ADMIN LOGIN
========================= */

const login =
  asyncHandler(
    async (req, res) => {

      const email =
        cleanString(
          req.body.email,
          150
        )
          .toLowerCase();

      const password =
        String(
          req.body.password || ''
        );


      if (
        !validEmail(email) ||
        !password
      ) {

        throw error(
          400,
          'Valid admin email and password are required.'
        );

      }


      const admin =
        await Admin
          .findOne({
            email
          })
          .select(
            '+passwordHash'
          );


      if (
        !admin ||
        !admin.isActive ||
        !(
          await bcrypt.compare(
            password,
            admin.passwordHash
          )
        )
      ) {

        throw error(
          401,
          'Invalid admin credentials.'
        );

      }


      admin.lastLoginAt =
        new Date();


      await admin.save();


      setAuthCookie(
        res,
        {
          sub:
            String(
              admin._id
            ),

          type:
            'admin'
        }
      );


      return ok(
        res,
        {

          message:
            'Admin login successful.',

          admin: {

            id:
              admin._id,

            name:
              admin.name,

            email:
              admin.email,

            role:
              admin.role

          }

        }
      );

    }
  );


/* =========================
   ADMIN LOGOUT
========================= */

const logout =
  asyncHandler(
    async (_req, res) => {

      clearAuthCookie(
        res
      );


      return ok(
        res,
        {
          message:
            'Logged out.'
        }
      );

    }
  );


/* =========================
   DASHBOARD
========================= */

const dashboard =
  asyncHandler(
    async (_req, res) => {

      const start =
        new Date();


      start.setHours(
        0,
        0,
        0,
        0
      );


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
      ] =
        await Promise.all([

          Order.countDocuments(),

          Order.countDocuments({
            createdAt: {
              $gte:
                start
            }
          }),

          Order.aggregate([

            {
              $match: {

                $or: [

                  {
                    paymentStatus:
                      'SUCCESS'
                  },

                  {
                    paymentMethod:
                      'COD',

                    orderStatus:
                      'Delivered'
                  }

                ]

              }
            },

            {
              $group: {

                _id:
                  null,

                total: {
                  $sum:
                    '$grandTotal'
                }

              }
            }

          ]),

          Order.countDocuments({
            paymentMethod:
              'RAZORPAY',

            paymentStatus:
              'SUCCESS'
          }),

          Order.countDocuments({
            paymentMethod:
              'COD'
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
            orderStatus:
              'Delivered'
          }),

          Order.countDocuments({
            orderStatus:
              'Cancelled'
          }),

          Product.countDocuments({
            isActive:
              true
          }),

          Product.countDocuments({
            isActive:
              true,

            stock: {
              $lte:
                5
            }
          }),

          User.countDocuments({
            isActive:
              true
          })

        ]);


      return ok(
        res,
        {

          dashboard: {

            totalOrders,

            todayOrders,

            totalSales:
              sales[0]?.total ||
              0,

            onlinePayments,

            codOrders,

            pendingOrders,

            deliveredOrders,

            cancelledOrders,

            totalProducts,

            lowStockProducts,

            totalCustomers

          }

        }
      );

    }
  );


/* =========================
   LIST PRODUCTS
========================= */

const listProducts =
  asyncHandler(
    async (_req, res) => {

      const products =
        await Product
          .find()
          .populate(
            'category',
            'name'
          )
          .sort({
            createdAt:
              -1
          })
          .lean();


      const categories =
        await Category
          .find()
          .sort({
            name:
              1
          })
          .lean();


      return ok(
        res,
        {
          products,
          categories
        }
      );

    }
  );


/* =========================
   CREATE PRODUCT
========================= */

const createProduct =
  asyncHandler(
    async (req, res) => {

      const b =
        req.body;


      if (
        !cleanString(
          b.name,
          180
        ) ||

        !cleanString(
          b.description,
          5000
        ) ||

        !b.category ||

        !nonNegativeNumber(
          b.originalPrice
        ) ||

        !nonNegativeNumber(
          b.sellingPrice
        ) ||

        Number(
          b.sellingPrice
        ) >
        Number(
          b.originalPrice
        ) ||

        !Number.isInteger(
          Number(
            b.stock
          )
        ) ||

        Number(
          b.stock
        ) < 0
      ) {

        throw error(
          400,
          'Invalid product details.'
        );

      }


      const slug =
        slugify(
          b.name
        );


      if (!slug) {

        throw error(
          400,
          'Product name must contain letters or numbers.'
        );

      }


      if (
        await Product.findOne({
          slug
        })
      ) {

        throw error(
          409,
          'A product with this name already exists.'
        );

      }


      if (
        !mongoose.isValidObjectId(
          b.category
        ) ||

        !(
          await Category.findOne({
            _id:
              b.category,

            isActive:
              true
          })
        )
      ) {

        throw error(
          400,
          'Valid active category is required.'
        );

      }


      const productId =
        `MC-P-${Date.now()
          .toString(36)
          .toUpperCase()}-${Math.random()
          .toString(36)
          .slice(2, 7)
          .toUpperCase()}`;


      const product =
        await Product.create({

          productId,

          name:
            cleanString(
              b.name,
              180
            ),

          slug,

          description:
            cleanString(
              b.description,
              5000
            ),

          keywords:
            Array.isArray(
              b.keywords
            )
              ? b.keywords
                  .map(
                    x =>
                      cleanString(
                        x,
                        50
                      )
                        .toLowerCase()
                  )
                  .filter(
                    Boolean
                  )
              : [],

          images:
            Array.isArray(
              b.images
            )
              ? b.images
              : [],

          category:
            b.category,

          originalPrice:
            Number(
              b.originalPrice
            ),

          sellingPrice:
            Number(
              b.sellingPrice
            ),

          stock:
            Number(
              b.stock
            ),

          isFeatured:
            Boolean(
              b.isFeatured
            ),

          isNewArrival:
            b.isNewArrival !==
            false,

          isBestSeller:
            Boolean(
              b.isBestSeller
            ),

          isActive:
            b.isActive !==
            false

        });


      return ok(
        res,
        {
          product
        },
        201
      );

    }
  );


/* =========================
   UPDATE PRODUCT
========================= */

const updateProduct =
  asyncHandler(
    async (req, res) => {

      const p =
        await Product.findById(
          req.params.id
        );


      if (!p) {

        throw error(
          404,
          'Product not found.'
        );

      }


      const b =
        req.body;


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
      ]
        .forEach(
          key => {

            if (
              b[key] !==
              undefined
            ) {

              p[key] =
                b[key];

            }

          }
        );


      if (
        b.name !==
        undefined
      ) {

        const slug =
          slugify(
            b.name
          );


        if (!slug) {

          throw error(
            400,
            'Invalid product name.'
          );

        }


        const duplicate =
          await Product.findOne({

            slug,

            _id: {
              $ne:
                p._id
            }

          });


        if (duplicate) {

          throw error(
            409,
            'A product with this name already exists.'
          );

        }


        p.slug =
          slug;

      }


      if (
        b.category !==
        undefined
      ) {

        if (
          !mongoose.isValidObjectId(
            b.category
          ) ||

          !(
            await Category.findOne({

              _id:
                b.category,

              isActive:
                true

            })
          )
        ) {

          throw error(
            400,
            'Valid active category is required.'
          );

        }

      }


      if (
        p.sellingPrice >
        p.originalPrice ||

        p.stock < 0
      ) {

        throw error(
          400,
          'Invalid price or stock.'
        );

      }


      await p.save();


      return ok(
        res,
        {
          product:
            p
        }
      );

    }
  );


/* =========================
   DELETE PRODUCT
========================= */

const deleteProduct =
  asyncHandler(
    async (req, res) => {

      const p =
        await Product.findById(
          req.params.id
        );


      if (!p) {

        throw error(
          404,
          'Product not found.'
        );

      }


      p.isActive =
        false;


      await p.save();


      return ok(
        res,
        {
          message:
            'Product disabled.'
        }
      );

    }
  );


/* =========================
   CREATE CATEGORY
========================= */

const createCategory =
  asyncHandler(
    async (req, res) => {

      const name =
        cleanString(
          req.body.name,
          80
        );


      const slug =
        slugify(
          name
        );


      if (
        name.length < 2 ||
        !slug
      ) {

        throw error(
          400,
          'Category name is required.'
        );

      }


      if (
        await Category.findOne({

          $or: [

            {
              name
            },

            {
              slug
            }

          ]

        })
      ) {

        throw error(
          409,
          'Category already exists.'
        );

      }


      const category =
        await Category.create({

          name,

          slug,

          description:
            cleanString(
              req.body.description,
              500
            ),

          imageUrl:
            cleanString(
              req.body.imageUrl,
              500
            )

        });


      return ok(
        res,
        {
          category
        },
        201
      );

    }
  );


/* =========================
   UPDATE CATEGORY
========================= */

const updateCategory =
  asyncHandler(
    async (req, res) => {

      const category =
        await Category.findById(
          req.params.id
        );


      if (!category) {

        throw error(
          404,
          'Category not found.'
        );

      }


      const name =
        cleanString(
          req.body.name,
          80
        );


      const slug =
        slugify(
          name
        );


      if (
        name.length < 2 ||
        !slug
      ) {

        throw error(
          400,
          'Category name is required.'
        );

      }


      if (
        await Category.findOne({

          $or: [

            {
              name
            },

            {
              slug
            }

          ],

          _id: {
            $ne:
              category._id
          }

        })
      ) {

        throw error(
          409,
          'Category already exists.'
        );

      }


      category.name =
        name;

      category.slug =
        slug;

      category.description =
        cleanString(
          req.body.description,
          500
        );

      category.imageUrl =
        cleanString(
          req.body.imageUrl,
          500
        );


      await category.save();


      return ok(
        res,
        {
          category
        }
      );

    }
  );


/* =========================
   DELETE CATEGORY
========================= */

const deleteCategory =
  asyncHandler(
    async (req, res) => {

      const category =
        await Category.findById(
          req.params.id
        );


      if (!category) {

        throw error(
          404,
          'Category not found.'
        );

      }


      category.isActive =
        false;


      await category.save();


      return ok(
        res,
        {
          message:
            'Category disabled.'
        }
      );

    }
  );


/* =========================
   LIST ORDERS
========================= */

const listOrders =
  asyncHandler(
    async (req, res) => {

      const filter =
        {};


      if (
        req.query.search
      ) {

        filter.orderId = {

          $regex:
            cleanString(
              req.query.search,
              50
            ),

          $options:
            'i'

        };

      }


      const orders =
        await Order
          .find(
            filter
          )
          .populate(
            'user',
            'fullName mobile email'
          )
          .sort({
            createdAt:
              -1
          })
          .limit(
            200
          )
          .lean();


      return ok(
        res,
        {
          orders
        }
      );

    }
  );


/* =========================
   UPDATE ORDER
========================= */

const updateOrder =
  asyncHandler(
    async (req, res) => {

      const order =
        await Order.findById(
          req.params.id
        );


      if (!order) {

        throw error(
          404,
          'Order not found.'
        );

      }


      const status =
        req.body.orderStatus;


      const allowed = [

        'Order Placed',
        'Confirmed',
        'Packed',
        'Shipped',
        'Out for Delivery',
        'Delivered',
        'Cancelled'

      ];


      if (
        !allowed.includes(
          status
        )
      ) {

        throw error(
          400,
          'Invalid order status.'
        );

      }


      if (
        order.orderStatus ===
        'Cancelled' &&

        status !==
        'Cancelled'
      ) {

        throw error(
          400,
          'Cancelled order cannot be reopened.'
        );

      }


      if (
        status ===
        'Cancelled' &&

        order.paymentMethod ===
        'RAZORPAY' &&

        order.paymentStatus ===
        'SUCCESS'
      ) {

        throw error(
          400,
          'Paid online orders require a refund workflow before cancellation.'
        );

      }


      if (
        status ===
        'Cancelled' &&

        order.orderStatus ===
        'Delivered'
      ) {

        throw error(
          400,
          'Delivered orders cannot be cancelled.'
        );

      }


      const session =
        await mongoose.startSession();


      try {

        await session.withTransaction(
          async () => {

            if (
              status ===
              'Cancelled'
            ) {

              await releaseStock(
                order,
                session
              );

            }


            order.orderStatus =
              status;


            order.statusHistory.push({

              status,

              note:
                cleanString(
                  req.body.note,
                  300
                ) ||
                'Status updated by admin.'

            });


            await order.save({
              session
            });

          }
        );

      } finally {

        await session.endSession();

      }


      return ok(
        res,
        {
          order
        }
      );

    }
  );


/* =========================
   LIST USERS
========================= */

const listUsers =
  asyncHandler(
    async (_req, res) => {

      const users =
        await User
          .find()
          .select(
            '-passwordHash'
          )
          .sort({
            createdAt:
              -1
          })
          .limit(
            500
          )
          .lean();


      return ok(
        res,
        {
          users
        }
      );

    }
  );


/* =========================
   USER ORDERS
========================= */

const userOrders =
  asyncHandler(
    async (req, res) => {

      if (
        !mongoose.isValidObjectId(
          req.params.id
        )
      ) {

        throw error(
          400,
          'Invalid user id.'
        );

      }


      const orders =
        await Order
          .find({
            user:
              req.params.id
          })
          .sort({
            createdAt:
              -1
          })
          .lean();


      return ok(
        res,
        {
          orders
        }
      );

    }
  );


/* =========================
   ENABLE / DISABLE USER
========================= */

const toggleUser =
  asyncHandler(
    async (req, res) => {

      const user =
        await User.findById(
          req.params.id
        );


      if (!user) {

        throw error(
          404,
          'User not found.'
        );

      }


      user.isActive =
        !user.isActive;


      await user.save();


      return ok(
        res,
        {
          user
        }
      );

    }
  );


/* =========================
   ADMIN RESET USER PASSWORD
========================= */

const resetUserPassword =
  asyncHandler(
    async (req, res) => {

      if (
        !mongoose.isValidObjectId(
          req.params.id
        )
      ) {

        throw error(
          400,
          'Invalid customer id.'
        );

      }


      const password =
        String(
          req.body.password || ''
        );


      if (
        password.length < 8
      ) {

        throw error(
          400,
          'Password minimum 8 characters ka hona chahiye.'
        );

      }


      if (
        password.length > 100
      ) {

        throw error(
          400,
          'Password bahut lamba hai.'
        );

      }


      const user =
        await User
          .findById(
            req.params.id
          )
          .select(
            '+passwordHash +passwordResetTokenHash +passwordResetExpiresAt'
          );


      if (!user) {

        throw error(
          404,
          'Customer not found.'
        );

      }


      user.passwordHash =
        await bcrypt.hash(
          password,
          12
        );


      user.passwordResetTokenHash =
        undefined;

      user.passwordResetExpiresAt =
        undefined;


      await user.save();


      return ok(
        res,
        {
          message:
            'Customer password updated successfully.'
        }
      );

    }
  );


/* =========================
   EXPORTS
========================= */

module.exports = {

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
