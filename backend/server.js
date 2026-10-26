
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
const wishlistRoutes = require('./routes/wishlistRoutes');

/* =========================================
   WEBSITE ANNOUNCEMENT API
========================================= */

const announcementRoutes =
  require('./routes/announcementRoutes');

/* =========================================
   PAYMENT WEBHOOK CONTROLLERS
========================================= */

const {
  webhook
} = require('./controllers/paymentController');

const {
  cashfreeWebhook
} = require('./controllers/cashfreeWebhookController');


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
   ALLOWED CORS ORIGINS
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
   CASHFREE WEBHOOK

   IMPORTANT:
   Register before express.json().

   Cashfree signature validation
   requires the original raw body.
========================================= */

app.post(
  '/api/cashfree/webhook',
  express.raw({
    type: 'application/json',
    limit: '1mb'
  }),
  cashfreeWebhook
);


/* =========================================
   MEMORA ORIGIN-BASED CSRF PROTECTION

   Reject state-changing requests originating
   from unapproved browser origins.

   Webhooks are mounted above this middleware:
   their signature verification remains intact.

   This is a browser CSRF mitigation, not a
   substitute for authentication or webhook
   signature verification.
========================================= */

app.use('/api', (req, res, next) => {
  const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

  if (safeMethods.has(req.method)) {
    return next();
  }

  // Health endpoints and webhook routes are not
  // browser-authenticated mutation endpoints.
  // Webhooks are already mounted before this middleware.
  const browserOrigin = req.get('origin');
  const fetchSite = req.get('sec-fetch-site');

  if (fetchSite === 'cross-site' && !browserOrigin) {
    return res.status(403).json({
      success: false,
      message: 'Cross-site request blocked.'
    });
  }

  if (browserOrigin && !allowedOrigins.has(browserOrigin)) {
    return res.status(403).json({
      success: false,
      message: 'Untrusted request origin.'
    });
  }

  // Browsers normally provide Origin on cross-origin POSTs.
  // When absent, additionally reject an untrusted Referer.
  if (!browserOrigin) {
    const referer = req.get('referer');
    if (referer) {
      try {
        const refererOrigin = new URL(referer).origin;
        const ownOrigin = req.protocol + '://' + req.get('host');

        if (!allowedOrigins.has(refererOrigin) &&
            refererOrigin !== ownOrigin) {
          return res.status(403).json({
            success: false,
            message: 'Untrusted request referer.'
          });
        }
      } catch (_) {
        return res.status(403).json({
          success: false,
          message: 'Invalid request referer.'
        });
      }
    }
  }

  next();
});


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

app.use(
  '/api/payment',
  paymentRoutes
);

app.use(
  '/api/cashfree',
  cashfreeRoutes
);

app.use(
  '/api/admin',
  adminRoutes
);

app.use(
  '/api/wishlist',
  wishlistRoutes
);


/* =========================================
   WEBSITE ANNOUNCEMENT ROUTES

   GET /api/announcement
   GET /api/announcement/manage
   PUT /api/announcement/manage
========================================= */

app.use(
  '/api/announcement',
  announcementRoutes
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
