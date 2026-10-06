const router = require('express').Router();

const c = require('../controllers/adminController');
const { requireAdmin } = require('../middleware/auth');

const cloudinaryController =
  require('../controllers/cloudinaryController');

const shiprocketController =
  require('../controllers/shiprocketController');

const {
  configured: shiprocketConfigured,
  getShiprocketToken
} = require('../services/shiprocketService');


/* =========================
   ADMIN AUTH
========================= */

router.post('/login', c.login);
router.post('/logout', c.logout);


/* =========================
   ADMIN LOGIN REQUIRED
========================= */

router.use(requireAdmin);


/* =========================
   SHIPROCKET TEST
========================= */

router.get('/shiprocket/test', async (req, res) => {

  try {

    if (!shiprocketConfigured()) {

      return res.status(500).json({
        success: false,
        message:
          'Shiprocket credentials are not configured.'
      });

    }

    await getShiprocketToken();

    return res.json({
      success: true,
      message:
        'Shiprocket connected successfully.'
    });

  } catch (error) {

    console.error(
      'Shiprocket connection test failed:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Shiprocket connection failed.'
    });

  }

});


/* =========================
   CLOUDINARY
========================= */

router.post(
  '/cloudinary/signature',
  cloudinaryController.signature
);


/* =========================
   DASHBOARD
========================= */

router.get(
  '/dashboard',
  c.dashboard
);


/* =========================
   PRODUCTS
========================= */

router.get(
  '/products',
  c.listProducts
);

router.post(
  '/products',
  c.createProduct
);

router.put(
  '/products/:id',
  c.updateProduct
);

router.delete(
  '/products/:id',
  c.deleteProduct
);


/* =========================
   CATEGORIES
========================= */

router.post(
  '/categories',
  c.createCategory
);

router.put(
  '/categories/:id',
  c.updateCategory
);

router.delete(
  '/categories/:id',
  c.deleteCategory
);


/* =========================
   ORDERS
========================= */

router.get(
  '/orders',
  c.listOrders
);

router.put(
  '/orders/:id',
  c.updateOrder
);


/* CREATE SHIPROCKET SHIPMENT */

router.post(
  '/orders/:id/create-shipment',
  shiprocketController.createShipment
);


/* =========================
   USERS
========================= */

router.get(
  '/users',
  c.listUsers
);

router.get(
  '/users/:id/orders',
  c.userOrders
);

router.patch(
  '/users/:id/toggle',
  c.toggleUser
);


module.exports = router;
