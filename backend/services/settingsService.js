'use strict';

/*
  Shop settings = what the owner saved in Admin -> Store Settings,
  falling back to the Render values (env) and then to built-in defaults.

  peek() is synchronous (uses a copy refreshed every 20 seconds and
  right after every save) so old code like deliveryFor() stays simple.
*/

let stored = {};
let loadedAt = 0;

const envBool = (name, fallback = false) => {
  const v = process.env[name];

  return v === undefined || v === '' ? fallback : String(v).toLowerCase() === 'true';
};

const envNum = (name, fallback) => {
  const n = Number(process.env[name]);

  return process.env[name] !== undefined && process.env[name] !== '' && Number.isFinite(n)
    ? n
    : fallback;
};

function defaults() {
  return {
    storeOpen: true,
    storeClosedMessage: 'We are not taking orders right now. Please visit again soon.',

    whatsapp: '918874050204',
    phone: '',
    email: '',
    address: 'Kotwa Kalan, Post Kotwa Bazar, Kushinagar, Uttar Pradesh - 274305',
    instagram: '',
    facebook: '',
    youtube: '',

    deliveryCharge: envNum('DELIVERY_CHARGE', 49),
    freeDeliveryAbove: envNum('FREE_DELIVERY_THRESHOLD', 499),

    codEnabled: true,
    codAdvanceEnabled: envBool('COD_ADVANCE_ENABLED'),
    codAdvancePercent: envNum('COD_ADVANCE_PERCENT', 30),

    returnsEnabled: true,
    returnWindowDays: envNum('RETURN_WINDOW_DAYS', 7),

    autoRefundEnabled: envBool('AUTO_REFUND_ENABLED'),
    codAutoReceiveDays: envNum('COD_AUTO_RECEIVE_DAYS', 0),

    // Empty = keep the text written in the page. Fill in the admin to change it.
    heroKicker: '',
    heroLine1: '',
    heroHighlight: '',
    heroDescription: '',
    heroButtonText: '',

    freeDeliveryBar: true,

    emailNotificationsEnabled: false,
    emailNotificationsSince: null,
    abandonedReminderEnabled: false,
    lowStockEmailEnabled: false,
    abandonedReminderSince: null,
    abandonedReminderHours: 24,

    welcomeEnabled: false,
    welcomePercent: 10,
    welcomeMaxDiscount: 100,
    welcomeMinOrder: 299,

    referralEnabled: false,
    referralFriendAmount: 50,
    referralRewardAmount: 50,
    referralMinOrder: 299,

    backupEmailEnabled: false,

    giftWrapEnabled: envBool('GIFT_WRAPPING_LIVE_ENABLED'),
    giftWrapStandardFee: envNum('GIFT_WRAP_STANDARD_FEE', 29),
    giftWrapPremiumFee: envNum('GIFT_WRAP_PREMIUM_FEE', 59),

    gstEnabled: false,
    gstLegalName: '',
    gstin: '',
    gstState: 'Uttar Pradesh',
    gstRate: 18
  };
}

function merge(saved) {
  const out = defaults();

  for (const [key, value] of Object.entries(saved || {})) {
    if (key in out && value !== undefined && value !== null && value !== '') {
      out[key] = value;
    }
  }

  // Empty text is a valid choice for the optional contact fields.
  for (const key of ['phone', 'email', 'instagram', 'facebook', 'youtube', 'heroKicker', 'heroLine1', 'heroHighlight', 'heroDescription', 'heroButtonText', 'gstLegalName', 'gstin']) {
    if (saved && typeof saved[key] === 'string') out[key] = saved[key];
  }

  return out;
}

function peek() {
  return merge(stored);
}

async function load(force = false) {
  if (!force && Date.now() - loadedAt < 20000) return peek();

  try {
    const SiteSettings = require('../models/SiteSettings');
    const doc = await SiteSettings.findOne({ key: 'main' }).lean();

    stored = doc || {};
    loadedAt = Date.now();
  } catch (err) {
    console.warn('[Settings] could not load:', err.message);
  }

  return peek();
}

function setStored(doc) {
  stored = doc || {};
  loadedAt = Date.now();
}

function startSettingsRefresh() {
  void load(true);

  const timer = setInterval(() => void load(true), 20000);

  timer.unref();
}

function assertStoreOpen(error) {
  const s = peek();

  if (!s.storeOpen) throw error(503, s.storeClosedMessage);
}

module.exports = { peek, load, setStored, merge, defaults, startSettingsRefresh, assertStoreOpen };
