'use strict';

/*
  GET /api/admin/launch-check

  A read-only "is the shop ready for real customers?" list. It only says
  whether settings exist (never their values), so no secret leaves the server.
*/

const LAUNCH = new Date('2026-11-12T00:00:00+05:30');

const has = v => Boolean(String(v || '').trim());

function buildChecks(env, facts) {
  const checks = [];
  const add = (id, level, title, detail, link) => checks.push({ id, level, title, detail, link });

  if (env.CASHFREE_ENV === 'production') {
    add('cashfree-mode', 'ok', 'Cashfree: asli (production) mode', 'Customer ka asli paisa katega.');
  } else {
    add('cashfree-mode', 'bad', 'Cashfree abhi SANDBOX (test) mode me hai',
      'Customer ka asli paisa nahi katega. Render me CASHFREE_ENV = production aur production keys daalein.');
  }

  add('cashfree-keys', has(env.CASHFREE_CLIENT_ID) && has(env.CASHFREE_CLIENT_SECRET) ? 'ok' : 'bad',
    'Cashfree keys', has(env.CASHFREE_CLIENT_ID) && has(env.CASHFREE_CLIENT_SECRET) ? 'Set hain.' : 'CASHFREE_CLIENT_ID / CASHFREE_CLIENT_SECRET Render me nahi mile.');

  add('shiprocket-login', has(env.SHIPROCKET_EMAIL) && has(env.SHIPROCKET_PASSWORD) ? 'ok' : 'bad',
    'Shiprocket login', has(env.SHIPROCKET_EMAIL) && has(env.SHIPROCKET_PASSWORD) ? 'Set hai.' : 'SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD Render me nahi mile.');

  add('shiprocket-live', env.SHIPROCKET_LIVE_SHIPMENTS_ENABLED === 'true' ? 'ok' : 'warn',
    'Shiprocket asli shipment', env.SHIPROCKET_LIVE_SHIPMENTS_ENABLED === 'true' ? 'Chalu hai (Create Shipment asli shipment banata hai).' : 'Safe mode me hai: asli shipment nahi banegi. Asli parcel bhejne ke liye SHIPROCKET_LIVE_SHIPMENTS_ENABLED = true karein.');

  add('shiprocket-pickup', has(env.SHIPROCKET_PICKUP_LOCATION) ? 'ok' : 'warn',
    'Shiprocket pickup address', has(env.SHIPROCKET_PICKUP_LOCATION) ? 'Set hai.' : 'SHIPROCKET_PICKUP_LOCATION Render me nahi mila: Shiprocket pickup ke liye apna default pickup address use karega.');

  add('auto-sync', env.SHIPMENT_AUTO_SYNC === 'false' ? 'warn' : 'ok',
    'Shiprocket status apne aap update', env.SHIPMENT_AUTO_SYNC === 'false'
      ? 'SHIPMENT_AUTO_SYNC = false hai: order Shipped/Delivered apne aap nahi badlega. Render se ye hata dein.'
      : 'Har 30 minute me Shiprocket se Shipped / Out for Delivery / Delivered apne aap aa jata hai.');

  if (facts.apiHost) {
    const own = /(^|\.)memoracreationscare\.in$/i.test(facts.apiHost);
    add('api-domain', own ? 'ok' : 'warn', 'Backend ka address',
      own ? 'Backend apne domain par hai (login cookie safe, iPhone/Safari par bhi chalta hai).'
        : 'Backend abhi onrender.com address par chal raha hai. iPhone/Safari par login ruk sakta hai. api.memoracreationscare.in use karein.');
  }

  if (facts.chatEnabled) {
    add('ai-chat', facts.chatKey ? 'ok' : 'bad', 'AI chat (Ask Memora)',
      facts.chatKey ? 'ON hai aur AI key laga hai.' : 'Chat ON hai par Render me GEMINI_API_KEY (ya ANTHROPIC_API_KEY) nahi hai: customer ko "chat available nahi" dikhega.', 'settings.html');
  }

  add('email', facts.mailConfigured ? 'ok' : 'warn', 'Customer ko email',
    facts.mailConfigured ? 'Email service juda hai.' : 'BREVO_API_KEY aur MAIL_FROM_EMAIL nahi mile, isliye order emails nahi jayengi.', 'settings.html');

  add('cloudinary', has(env.CLOUDINARY_CLOUD_NAME) && has(env.CLOUDINARY_API_KEY) && has(env.CLOUDINARY_API_SECRET) ? 'ok' : 'bad',
    'Photo upload (Cloudinary)', has(env.CLOUDINARY_API_SECRET) ? 'Set hai.' : 'CLOUDINARY_* Render me nahi mile: product photo upload nahi hogi.');

  add('security', has(env.JWT_SECRET) && String(env.JWT_SECRET).length >= 32 ? 'ok' : 'bad',
    'Login ki surakhsha (JWT_SECRET)', String(env.JWT_SECRET || '').length >= 32 ? 'Majboot hai.' : 'JWT_SECRET chhota ya khali hai. 32+ akshar ka random secret daalein.');

  add('store-open', facts.storeOpen ? 'ok' : 'warn', 'Store khula hai',
    facts.storeOpen ? 'Customers order kar sakte hain.' : 'Store BAND hai: customers order nahi kar sakte.', 'settings.html');

  add('products', facts.activeProducts > 0 ? (facts.withoutPhoto ? 'warn' : 'ok') : 'bad', 'Products',
    facts.activeProducts === 0 ? 'Website par koi product nahi dikh raha.'
      : facts.withoutPhoto ? `${facts.activeProducts} product dikh rahe hain, unme ${facts.withoutPhoto} ki photo nahi hai.`
        : `${facts.activeProducts} product website par dikh rahe hain.`, 'products.html');

  add('test-orders', facts.testOrders ? 'warn' : 'ok', 'Purane test orders',
    facts.testOrders ? `${facts.testOrders} order launch se pehle ke hain. Dashboard ke numbers saaf karne ke liye hatayein.` : 'Koi purana test order nahi.', 'test-cleanup.html');

  return checks;
}

async function gather(models = require('../models'), settings = require('../services/settingsService'), mail = require('../services/mailService'), req = {}) {
  const { Order, Product } = models;
  const [activeProducts, withoutPhoto, testOrders] = await Promise.all([
    Product.countDocuments({ isActive: true }),
    Product.countDocuments({ isActive: true, $or: [{ images: { $size: 0 } }, { images: { $exists: false } }] }),
    Order.countDocuments({ createdAt: { $lt: LAUNCH } })
  ]);

  return {
    activeProducts, withoutPhoto, testOrders,
    mailConfigured: mail.mailConfigured(),
    storeOpen: settings.peek().storeOpen !== false,
    apiHost: req.hostname || '',
    chatEnabled: settings.peek().chatEnabled === true,
    chatKey: has(process.env.GEMINI_API_KEY) || has(process.env.ANTHROPIC_API_KEY)
  };
}

const check = async (req, res, next) => {
  try {
    const { ok } = require('../utils/http');
    const checks = buildChecks(process.env, await gather(undefined, undefined, undefined, req));

    return ok(res, {
      checks,
      summary: { bad: checks.filter(c => c.level === 'bad').length, warn: checks.filter(c => c.level === 'warn').length }
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = { check, buildChecks, LAUNCH };
