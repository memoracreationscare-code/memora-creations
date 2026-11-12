'use strict';

/*
  GET /api/admin/settings   current values (saved + defaults)
  PUT /api/admin/settings   save changes
*/

const SiteSettings = require('../models/SiteSettings');
const settings = require('../services/settingsService');
const { asyncHandler, error, ok } = require('../utils/http');

const TEXT = {
  storeClosedMessage: 300, address: 300, instagram: 200, facebook: 200,
  youtube: 200, email: 120, phone: 20, heroKicker: 60, heroLine1: 60,
  heroHighlight: 60, heroDescription: 300, heroButtonText: 40,
  gstLegalName: 100, gstin: 20, gstState: 40
};

const BOOL = [
  'storeOpen', 'codEnabled', 'codAdvanceEnabled', 'returnsEnabled',
  'autoRefundEnabled', 'freeDeliveryBar', 'emailNotificationsEnabled',
  'abandonedReminderEnabled', 'lowStockEmailEnabled', 'welcomeEnabled', 'referralEnabled', 'giftWrapEnabled', 'gstEnabled'
];

const NUMBER = {
  deliveryCharge: [0, 5000],
  freeDeliveryAbove: [0, 1000000],
  codAdvancePercent: [5, 90],
  returnWindowDays: [1, 60],
  codAutoReceiveDays: [0, 60],
  abandonedReminderHours: [1, 168],
  welcomePercent: [1, 90],
  welcomeMaxDiscount: [0, 100000],
  welcomeMinOrder: [0, 100000],
  referralFriendAmount: [1, 5000],
  referralRewardAmount: [1, 5000],
  referralMinOrder: [0, 100000],
  giftWrapStandardFee: [0, 2000],
  giftWrapPremiumFee: [0, 2000],
  gstRate: [0, 28]
};

const NUMBER_LABEL = {
  deliveryCharge: 'Delivery charge',
  freeDeliveryAbove: 'Free delivery above',
  codAdvancePercent: 'COD advance percent',
  returnWindowDays: 'Return days',
  codAutoReceiveDays: 'COD auto-receive days',
  abandonedReminderHours: 'Reminder hours',
  welcomePercent: 'Welcome discount percent',
  welcomeMaxDiscount: 'Welcome maximum discount',
  welcomeMinOrder: 'Welcome minimum order',
  referralFriendAmount: 'Friend reward',
  referralRewardAmount: 'Referrer reward',
  referralMinOrder: 'Referral minimum order',
  giftWrapStandardFee: 'Standard gift wrap price',
  giftWrapPremiumFee: 'Premium gift wrap price',
  gstRate: 'GST rate'
};

const isUrl = v => !v || /^https?:\/\/[^\s]+$/i.test(v);

function clean(body) {
  const out = {};

  for (const [key, max] of Object.entries(TEXT)) {
    if (body[key] === undefined) continue;

    const value = String(body[key]).trim().slice(0, max);

    if (['instagram', 'facebook', 'youtube'].includes(key) && !isUrl(value)) {
      throw error(400, `${key} link must start with https://`);
    }

    if (key === 'gstin') {
      const g = value.toUpperCase();

      if (g && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) {
        throw error(400, 'GSTIN 15 akshar ka hona chahiye (jaise 09ABCDE1234F1Z5).');
      }

      out[key] = g;
      continue;
    }

    if (key === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw error(400, 'Email address is not valid.');
    }

    out[key] = value;
  }

  if (body.whatsapp !== undefined) {
    const digits = String(body.whatsapp).replace(/\D/g, '');

    if (digits.length === 10) out.whatsapp = '91' + digits;
    else if (/^\d{11,15}$/.test(digits)) out.whatsapp = digits;
    else throw error(400, 'WhatsApp number must be 10 digits (or with country code).');
  }

  for (const key of BOOL) {
    if (body[key] !== undefined) out[key] = body[key] === true;
  }

  for (const [key, [min, max]] of Object.entries(NUMBER)) {
    if (body[key] === undefined || body[key] === '') continue;

    const n = Number(body[key]);

    if (!Number.isFinite(n) || n < min || n > max) {
      throw error(400, `${NUMBER_LABEL[key]} must be between ${min} and ${max}.`);
    }

    out[key] = Math.round(n * 100) / 100;
  }

  return out;
}

const getSettings = asyncHandler(async (_req, res) => {
  return ok(res, {
    settings: await settings.load(true),
    mailConfigured: require('../services/mailService').mailConfigured()
  });
});

const updateSettings = asyncHandler(async (req, res) => {
  const changes = clean(req.body || {});

  // Emails only go for orders/carts that appear AFTER the owner switches
  // them on, so old customers never get a surprise email.
  const before = settings.peek();
  const now = new Date();

  if (changes.emailNotificationsEnabled === true && !before.emailNotificationsEnabled) {
    changes.emailNotificationsSince = now;
  }

  if (changes.abandonedReminderEnabled === true && !before.abandonedReminderEnabled) {
    changes.abandonedReminderSince = now;
  }

  const doc = await SiteSettings.findOneAndUpdate(
    { key: 'main' },
    { $set: changes, $setOnInsert: { key: 'main' } },
    { upsert: true, new: true, runValidators: true }
  ).lean();

  settings.setStored(doc);

  // Keep the WELCOME coupon in step with the settings.
  try {
    await require('../services/referralService').syncWelcomeCoupon(settings.peek());
  } catch (err) {
    console.warn('[Welcome coupon]', err.message);
  }

  return ok(res, { settings: settings.peek(), mailConfigured: require('../services/mailService').mailConfigured(), message: 'Settings saved. The website now uses them.' });
});

module.exports = { getSettings, updateSettings, clean };
