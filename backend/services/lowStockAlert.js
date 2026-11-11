'use strict';

/*
  Emails the owner when products are nearly out of stock (3 or fewer).

  - One email lists all such products; each product is mentioned once, and
    again only after it was restocked and ran low again.
  - Goes to the store Email in Store Settings (or ADMIN_ALERT_EMAIL).
  - Off until the owner ticks it in Store Settings.
*/

const LOW = 3;

function defaultDeps() {
  return {
    Product: require('../models').Product,
    settings: require('./settingsService'),
    mail: require('./mailService')
  };
}

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function lowLines(product) {
  const options = (product.variants || []).filter(v => Number(v.stock) <= LOW);

  return options.length
    ? options.map(v => `${product.name} (${v.label}): ${v.stock} bacha`)
    : [`${product.name}: ${product.stock} bacha`];
}

function buildEmail(products) {
  const lines = products.flatMap(lowLines);

  return {
    subject: `Stock kam hai: ${products.length} product`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#302117">
      <h2>⚠️ Ye products khatam hone wale hain</h2>
      <ul>${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
      <p>Admin → Products me stock badha dein, warna customer order nahi kar payenge.</p></div>`
  };
}

async function sweepLowStock(deps = defaultDeps()) {
  const { Product, settings, mail } = deps;
  const config = settings.peek();

  if (!config.lowStockEmailEnabled || !mail.mailConfigured()) return { sent: 0 };

  // restocked products can warn again later
  await Product.updateMany(
    { lowStockAlertedAt: { $ne: null }, stock: { $gt: LOW }, variants: { $not: { $elemMatch: { stock: { $lte: LOW } } } } },
    { $unset: { lowStockAlertedAt: 1 } },
    { timestamps: false }
  );

  const to = config.email || process.env.ADMIN_ALERT_EMAIL;

  if (!to) return { sent: 0 };

  const products = await Product.find({
    isActive: true,
    $or: [{ lowStockAlertedAt: null }, { lowStockAlertedAt: { $exists: false } }],
    $and: [{ $or: [{ stock: { $lte: LOW } }, { 'variants.stock': { $lte: LOW } }] }]
  }).select('name stock variants').limit(50).lean();

  if (!products.length) return { sent: 0 };

  const ids = products.map(p => p._id);

  await Product.updateMany({ _id: { $in: ids } }, { $set: { lowStockAlertedAt: new Date() } }, { timestamps: false });

  try {
    const message = buildEmail(products);

    await mail.sendMail({ to, subject: message.subject, html: message.html });

    return { sent: products.length };
  } catch (err) {
    await Product.updateMany({ _id: { $in: ids } }, { $unset: { lowStockAlertedAt: 1 } }, { timestamps: false });
    console.warn('[Low stock email]', err.message);

    return { sent: 0, failed: true };
  }
}

module.exports = { sweepLowStock, buildEmail, LOW };
