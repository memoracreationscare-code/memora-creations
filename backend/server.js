
require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const connectDatabase = require('./config/db');

/* ========================================
   API ROUTES
======================================== */

const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const profileRoutes = require('./routes/profileRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const cashfreeRoutes = require('./routes/cashfreeRoutes');
const adminRoutes = require('./routes/adminRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const couponRoutes = require('./routes/couponRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const announcementRoutes =
  require('./routes/announcementRoutes');
const deliveryRoutes =
  require('./routes/deliveryRoutes');

/* ========================================
   WEBHOOK CONTROLLERS
======================================== */

const {
  webhook
} = require('./controllers/paymentController');

const {
  cashfreeWebhook
} = require('./controllers/cashfreeWebhookController');

/* ========================================
   EXPRESS APPLICATION
======================================== */

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

/* ========================================
   SECURITY HEADERS
======================================== */

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

/* ========================================
   CORS
======================================== */

const configuredOrigins = (
  process.env.CORS_ORIGIN ||
  'http://localhost:5000'
)
  .split(',')
  .map(origin =>
    origin.trim().replace(/\/+$/, '')
  )
  .filter(Boolean);

const allowedOrigins = new Set([
  ...configuredOrigins,
  'https://memoracreationscare-code.github.io',
  'https://memora-creations.pages.dev'
]);

app.use(
  cors({
    origin(origin, callback) {
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

/* ========================================
   PAYMENT WEBHOOKS
   Keep raw body before express.json()
======================================== */

app.post(
  '/api/payment/webhook',
  express.raw({
    type: 'application/json',
    limit: '1mb'
  }),
  webhook
);

app.post(
  '/api/cashfree/webhook',
  express.raw({
    type: 'application/json',
    limit: '1mb'
  }),
  cashfreeWebhook
);

/* ========================================
   ORIGIN BASED CSRF PROTECTION
======================================== */

app.use('/api', (req, res, next) => {
  const safeMethods = new Set([
    'GET',
    'HEAD',
    'OPTIONS'
  ]);

  if (safeMethods.has(req.method)) {
    return next();
  }

  const browserOrigin = req.get('origin');
  const fetchSite = req.get('sec-fetch-site');

  if (fetchSite === 'cross-site' && !browserOrigin) {
    return res.status(403).json({
      success: false,
      message: 'Cross-site request blocked.'
    });
  }

  if (
    browserOrigin &&
    !allowedOrigins.has(browserOrigin)
  ) {
    return res.status(403).json({
      success: false,
      message: 'Untrusted request origin.'
    });
  }

  if (!browserOrigin) {
    const referer = req.get('referer');

    if (referer) {
      try {
        const refererOrigin =
          new URL(referer).origin;

        const ownOrigin =
          req.protocol + '://' + req.get('host');

        if (
          !allowedOrigins.has(refererOrigin) &&
          refererOrigin !== ownOrigin
        ) {
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

/* ========================================
   BODY PARSERS
======================================== */

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

/* ========================================
   RATE LIMITING
======================================== */

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

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/admin/login', authLimiter);
app.use('/api/payment', authLimiter);
app.use('/api/cashfree', authLimiter);

/* ========================================
   REVIEW RATE LIMITING
======================================== */

const reviewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message:
      'Too many review requests. Please try later.'
  }
});

app.use(
  '/api/reviews',
  (req, res, next) => {
    if (
      req.method === 'POST' ||
      req.method === 'PATCH' ||
      req.method === 'DELETE'
    ) {
      return reviewLimiter(req, res, next);
    }

    next();
  }
);

/* ========================================
   API HEALTH CHECK
======================================== */

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    service: 'memora-creations-api',
    whatsappOrder: false
  });
});

/* ========================================
   CUSTOMER API ROUTES
======================================== */

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/cashfree', cashfreeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/announcement', announcementRoutes);

/* ========================================
   SAFE STATIC FILE SERVING

   Only frontend and admin directories
   are served as static files.

   Never expose backend source, .env,
   scripts or project configuration.
======================================== */

const projectRoot = path.join(__dirname, '..');

const staticOptions = {
  dotfiles: 'deny',
  index: false,
  fallthrough: true
};

app.use(
  '/frontend',
  express.static(
    path.join(projectRoot, 'frontend'),
    staticOptions
  )
);

app.use(
  '/admin',
  express.static(
    path.join(projectRoot, 'admin'),
    staticOptions
  )
);

/* ========================================
   API NOT FOUND
======================================== */

app.use('/api', (_req, res) => {
  res.status(404).json({
    success: false,
    message: 'API route not found.'
  });
});

/* ========================================
   GLOBAL ERROR HANDLER
======================================== */

app.use((err, _req, res, _next) => {
  console.error(err);

  const status =
    Number(err.statusCode || err.status) || 500;

  res.status(
    status >= 400 && status < 600
      ? status
      : 500
  ).json({
    success: false,
    message:
      status >= 400 && status < 500
        ? err.message
        : 'Internal server error.'
  });
});

/* ========================================
   SERVER START
======================================== */

const port = Number(process.env.PORT || 5000);

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

/* ========================================
   EXPORT APP
======================================== */

module.exports = app;
