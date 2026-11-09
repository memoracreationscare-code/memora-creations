
require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const connectDatabase = require('./config/db');
const { sanitizeRequest } = require('./middleware/sanitize');
const codAdvanceRules = require('./utils/codAdvance');

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
   GZIP COMPRESSION
   Order and product lists are large JSON;
   compressing them makes pages load faster.
======================================== */

let compression = null;

try {
  compression = require('compression');
} catch (err) {
  // Never stop the shop because of an optional speed-up.
  console.warn(
    'compression package not installed; responses will not be gzipped.'
  );
}

if (compression) {
  app.use(compression());
}

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

// Remove MongoDB operators ($...) from user input.
app.use(sanitizeRequest);

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

// Password-reset requests only need a few tries per person.
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    message:
      'Too many requests. Please try again later.'
  }
});

app.use('/api/auth/forgot-password', resetLimiter);
app.use('/api/auth/reset-password', resetLimiter);

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
    whatsappOrder: false,
    codAdvance: {
      enabled: codAdvanceRules.isEnabled(),
      percent: codAdvanceRules.percent()
    }
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
app.use('/api/settings', require('./routes/settingsRoutes'));

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
  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not set. Logins cannot be secured.');
    process.exit(1);
  }

  if (process.env.JWT_SECRET.length < 32) {
    console.warn(
      'WARNING: JWT_SECRET is shorter than 32 characters. ' +
      'Set a long random value in Render.'
    );
  }

  connectDatabase()
    .then(() => {
      app.listen(port, () => {
        // Move orders to Shipped / Delivered from Shiprocket tracking.
        require('./services/shipmentSync').startShipmentSync();

        // Cancel online orders that were never paid (and fix missed webhooks).
        require('./services/pendingPaymentSweeper').startPendingPaymentSweeper();

        // Read Cashfree refunds back into orders (also manual refunds).
        require('./services/refundSync').startRefundSync();

        // Owner-editable shop settings (Admin -> Store Settings).
        require('./services/settingsService').startSettingsRefresh();

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
