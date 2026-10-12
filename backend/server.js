
require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const connectDatabase = require('./config/db');

/* =========================================
   API ROUTES
========================================= */

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const profileRoutes = require('./routes/profileRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const cashfreeRoutes = require('./routes/cashfreeRoutes');
const adminRoutes = require('./routes/adminRoutes');

/* =========================================
   EXISTING RAZORPAY WEBHOOK
========================================= */

const {
  webhook
} = require('./controllers/paymentController');


/* =========================================
   EXPRESS APPLICATION
========================================= */

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);


/* =========================================
   SECURITY HEADERS
========================================= */

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);


/* =========================================
   MEMORA CREATIONS - ALLOWED ORIGINS
========================================= */

const configuredOrigins = (
  process.env.CORS_ORIGIN ||
  'http://localhost:5000'
)
  .split(',')
  .map(origin => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const allowedOrigins = new Set([
  ...configuredOrigins,

  'https://memoracreationscare-code.github.io',

  'https://memora-creations.pages.dev'
]);

app.use(
  cors({
    origin: function (origin, callback) {

      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },

    credentials: true
  })
);


/* =========================================
   RAZORPAY WEBHOOK
   PRESERVED FOR EXISTING ORDERS
========================================= */

app.post(
  '/api/payment/webhook',
  express.raw({
    type: 'application/json',
    limit: '1mb'
  }),
  webhook
);


/* =========================================
   BODY PARSERS
========================================= */

app.use(
  express.json({
    limit: '2mb'
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '2mb'
  })
);

app.use(cookieParser());


/* =========================================
   RATE LIMITING
========================================= */

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 30,

  standardHeaders: 'draft-7',

  legacyHeaders: false,

  message: {
    success: false,
    message:
      'Too many requests. Please try again later.'
  }
});


app.use(
  '/api/auth/login',
  authLimiter
);

app.use(
  '/api/auth/register',
  authLimiter
);

app.use(
  '/api/admin/login',
  authLimiter
);

app.use(
  '/api/payment',
  authLimiter
);

/* =========================================
   CASHFREE RATE LIMITING
========================================= */

app.use(
  '/api/cashfree',
  authLimiter
);


/* =========================================
   HEALTH CHECK
========================================= */

app.get(
  '/api/health',
  (_req, res) => {
    res.json({
      success: true,

      service: 'memora-creations-api',

      whatsappOrder: false
    });
  }
);


/* =========================================
   API ROUTES
========================================= */

app.use(
  '/api/auth',
  authRoutes
);

app.use(
  '/api/products',
  productRoutes
);

app.use(
  '/api/cart',
  cartRoutes
);

app.use(
  '/api/profile',
  profileRoutes
);

app.use(
  '/api/orders',
  orderRoutes
);

/* =========================================
   RAZORPAY PAYMENT ROUTES
   KEPT FOR EXISTING CHECKOUT
========================================= */

app.use(
  '/api/payment',
  paymentRoutes
);


/* =========================================
   NEW CASHFREE PAYMENT ROUTES

   POST /api/cashfree/create-order
   POST /api/cashfree/verify
========================================= */

app.use(
  '/api/cashfree',
  cashfreeRoutes
);


/* =========================================
   ADMIN ROUTES
========================================= */

app.use(
  '/api/admin',
  adminRoutes
);


/* =========================================
   STATIC FILES
========================================= */

app.use(
  express.static(
    path.join(__dirname, '..')
  )
);


/* =========================================
   API 404 HANDLER
========================================= */

app.use(
  '/api',
  (_req, res) => {
    res.status(404).json({
      success: false,
      message: 'API route not found.'
    });
  }
);


/* =========================================
   GLOBAL ERROR HANDLER
========================================= */

app.use(
  (err, _req, res, _next) => {

    console.error(err);

    const status =
      err.statusCode || 500;

    res.status(status).json({
      success: false,

      message:
        status < 500
          ? err.message
          : 'Internal server error.'
    });

  }
);


/* =========================================
   SERVER START
========================================= */

const port =
  Number(process.env.PORT || 5000);


if (require.main === module) {

  connectDatabase()

    .then(() => {

      app.listen(port, () => {

        console.log(
          `Memora Creations running on port ${port}`
        );

      });

    })

    .catch(error => {

      console.error(
        `Startup failed: ${error.message}`
      );

      process.exit(1);

    });

}


/* =========================================
   EXPORT APP
========================================= */

module.exports = app;
