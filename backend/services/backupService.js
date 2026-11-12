'use strict';

/*
  A copy of the shop data the owner can keep: orders, products, categories,
  customers, coupons, reviews and store settings, as one JSON file.
  Never included: passwords, reset tokens, admin accounts, payment keys.

  - Admin -> Store Settings -> "Backup abhi download karo"
  - Optional: once a day by email to the store email (gzip attached).
  This is a EXTRA copy. MongoDB Atlas backups remain the main safety net.
*/

const zlib = require('zlib');

const MAX_EMAIL_BYTES = 3 * 1024 * 1024;   // mail providers refuse large attachments
const EVERY_MS = 23 * 60 * 60 * 1000;

function defaultDeps() {
  const models = require('../models');

  return {
    models,
    SiteSettings: require('../models/SiteSettings'),
    settings: require('./settingsService'),
    mail: require('./mailService')
  };
}

async function collect(models, SiteSettings) {
  const [orders, products, categories, users, coupons, reviews, settings] = await Promise.all([
    models.Order.find().sort({ createdAt: -1 }).limit(20000).lean(),
    models.Product.find().limit(5000).lean(),
    models.Category.find().lean(),
    models.User.find().select('-passwordHash -passwordResetTokenHash -passwordResetExpiresAt -avatar').limit(20000).lean(),
    models.Coupon.find().limit(2000).lean(),
    models.Review.find().limit(20000).lean(),
    SiteSettings.findOne({ key: 'main' }).lean()
  ]);

  return { orders, products, categories, users, coupons, reviews, settings };
}

async function buildBackup(deps = defaultDeps()) {
  const data = await collect(deps.models, deps.SiteSettings);
  const generatedAt = new Date().toISOString();
  const counts = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v.length : v ? 1 : 0])
  );
  const json = JSON.stringify({ app: 'memora-creations', generatedAt, counts, ...data });

  return { json, gzip: zlib.gzipSync(Buffer.from(json)), counts, generatedAt };
}

async function sweepBackup(deps = defaultDeps(), now = new Date()) {
  const { SiteSettings, settings, mail } = deps;
  const config = settings.peek();

  if (!config.backupEmailEnabled || !mail.mailConfigured()) return { sent: false };

  const to = config.email || process.env.ADMIN_ALERT_EMAIL;

  if (!to) return { sent: false };

  const row = await SiteSettings.findOne({ key: 'main' }).select('lastBackupEmailAt').lean();

  if (row && row.lastBackupEmailAt && now - new Date(row.lastBackupEmailAt) < EVERY_MS) return { sent: false };

  // claim the slot first so two servers do not both send
  await SiteSettings.updateOne({ key: 'main' }, { $set: { lastBackupEmailAt: now } }, { upsert: true });

  try {
    const backup = await buildBackup(deps);
    const day = backup.generatedAt.slice(0, 10);
    const small = backup.gzip.length <= MAX_EMAIL_BYTES;
    const c = backup.counts;

    await mail.sendMail({
      to,
      subject: `Memora backup ${day}`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#302117">
        <h3>🗄 Roz ka backup</h3>
        <p>Orders: ${c.orders}, Products: ${c.products}, Customers: ${c.users}, Reviews: ${c.reviews}.</p>
        <p>${small ? 'File is email ke saath judi hai (.json.gz). Isme customers ka address aur phone hai, ise safe rakhein.' : 'Backup bahut bada hai email ke liye. Admin → Store Settings → "Backup abhi download karo" se download karein.'}</p></div>`,
      attachments: small ? [{ name: `memora-backup-${day}.json.gz`, contentBase64: backup.gzip.toString('base64') }] : undefined
    });

    return { sent: true, bytes: backup.gzip.length };
  } catch (err) {
    await SiteSettings.updateOne({ key: 'main' }, { $set: { lastBackupEmailAt: row && row.lastBackupEmailAt ? row.lastBackupEmailAt : null } });
    throw err;
  }
}

module.exports = { buildBackup, collect, sweepBackup, EVERY_MS, MAX_EMAIL_BYTES };
