'use strict';

/*
  Keys the owner can set from Admin -> Connections instead of Render.

  - Stored ENCRYPTED (AES-256-GCM, utils/secretBox) in the SecretVault model.
  - A saved value replaces the Render value while it exists; removing it
    puts the Render value back.
  - Only the keys listed in FIELDS can be set. JWT_SECRET, the database
    address and the Cloudinary secret are NOT here on purpose.
  - Nothing here ever returns a secret value: status() only says where
    each key comes from.
*/

const secretBox = require('../utils/secretBox');

const ONE_LINE = v => /^[^\r\n\0]{1,500}$/.test(v);

const FIELDS = {
  CASHFREE_CLIENT_ID: { label: 'Cashfree Client ID', secret: true, check: ONE_LINE },
  CASHFREE_CLIENT_SECRET: { label: 'Cashfree Client Secret', secret: true, check: ONE_LINE },
  CASHFREE_ENV: { label: 'Cashfree mode (sandbox ya production)', secret: false, check: v => v === 'sandbox' || v === 'production' },
  SHIPROCKET_EMAIL: { label: 'Shiprocket login email', secret: false, check: v => ONE_LINE(v) && v.includes('@') },
  SHIPROCKET_PASSWORD: { label: 'Shiprocket password', secret: true, check: ONE_LINE },
  SHIPROCKET_PICKUP_LOCATION: { label: 'Shiprocket pickup location ka naam', secret: false, check: ONE_LINE },
  BREVO_API_KEY: { label: 'Email (Brevo) API key', secret: true, check: ONE_LINE },
  MAIL_FROM_EMAIL: { label: 'Email bhejne wala address', secret: false, check: v => ONE_LINE(v) && v.includes('@') },
  ADMIN_ALERT_EMAIL: { label: 'Aapka email (alerts yahan aayenge)', secret: false, check: v => ONE_LINE(v) && v.includes('@') },
  GEMINI_API_KEY: { label: 'AI chat key (Gemini)', secret: true, check: ONE_LINE }
};

const renderValues = {}; // what Render had, remembered the first time we override a key
let panelKeys = new Set();

function vault() {
  return require('../models/SecretVault');
}

function apply(values) {
  const next = new Set();

  for (const name of Object.keys(FIELDS)) {
    let plain = null;

    if (values && values[name]) {
      try { plain = secretBox.open(values[name]); } catch (_) { plain = null; } // unreadable: fall back to Render
    }

    if (plain) {
      if (!(name in renderValues)) renderValues[name] = process.env[name];
      process.env[name] = plain;
      next.add(name);
    } else if (name in renderValues) {
      if (renderValues[name] === undefined) delete process.env[name];
      else process.env[name] = renderValues[name];
      delete renderValues[name];
    }
  }

  panelKeys = next;

  try { require('./shiprocketService').resetShiprocketToken(); } catch (_) { /* nothing to reset */ }
}

async function applyAll() {
  try {
    const doc = await vault().findOne({ key: 'main' }).lean();

    apply(doc && doc.values);
  } catch (err) {
    console.warn('[Secrets] could not load:', err.message);
  }
}

function status() {
  return Object.entries(FIELDS).map(([name, f]) => {
    const fromPanel = panelKeys.has(name);
    const has = Boolean(String(process.env[name] || '').trim());

    return {
      name,
      label: f.label,
      secret: f.secret,
      source: fromPanel ? 'panel' : has ? 'render' : 'none',
      // Only harmless, non-secret settings may be shown back.
      value: f.secret ? undefined : (has ? String(process.env[name]) : '')
    };
  });
}

/* updates: { NAME: 'new value' | null }  (null / '' = remove the panel value) */
function validate(updates) {
  const clean = {};

  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) return { error: 'Kuch badalne ko nahi mila.' };

  for (const [name, raw] of Object.entries(updates)) {
    const f = FIELDS[name];

    if (!f) return { error: 'Ye key panel se nahi badal sakti: ' + String(name).slice(0, 40) };

    if (raw === null || raw === '') { clean[name] = null; continue; }

    const value = String(raw).trim();

    if (!f.check(value)) return { error: `${f.label}: value sahi nahi lag rahi.` };

    clean[name] = value;
  }

  if (!Object.keys(clean).length) return { error: 'Kuch badalne ko nahi mila.' };

  return { clean };
}

async function save(clean) {
  const set = {};
  const unset = {};

  for (const [name, value] of Object.entries(clean)) {
    if (value === null) unset['values.' + name] = '';
    else set['values.' + name] = secretBox.seal(value);
  }

  const op = {};

  if (Object.keys(set).length) op.$set = set;
  if (Object.keys(unset).length) op.$unset = unset;

  const doc = await vault().findOneAndUpdate({ key: 'main' }, op, { upsert: true, new: true }).lean();

  apply(doc && doc.values);
}

module.exports = { FIELDS, apply, applyAll, status, validate, save };
