'use strict';

/*
  Weekly summary email (Monday morning, India time) to the store email:
  orders, sales, best sellers, low stock and new customers for the last 7 days
  compared with the 7 days before. Switch: Admin -> Store Settings.
*/

const IST_MS = 330 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const MIN_GAP = 6 * DAY;

function defaultDeps() {
  return {
    models: require('../models'),
    SiteSettings: require('../models/SiteSettings'),
    settings: require('./settingsService'),
    mail: require('./mailService')
  };
}

const istParts = d => {
  const x = new Date(d.getTime() + IST_MS);

  return { day: x.getUTCDay(), hour: x.getUTCHours() };
};

// Midnight (India time) that starts today, as a real Date.
function startOfTodayIST(now) {
  const x = new Date(now.getTime() + IST_MS);

  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()) - IST_MS);
}

const rs = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Orders that count: really placed (not abandoned/failed payment) and not cancelled.
const REAL = { paymentStatus: { $nin: ['PENDING', 'FAILED'] }, orderStatus: { $ne: 'Cancelled' } };

async function weekNumbers(Order, from, to) {
  const rows = await Order.aggregate([
    { $match: { ...REAL, createdAt: { $gte: from, $lt: to } } },
    {
      $group: {
        _id: null,
        orders: { $sum: 1 },
        revenue: { $sum: { $cond: [{ $or: [{ $eq: ['$paymentMethod', 'COD'] }, { $eq: ['$paymentStatus', 'SUCCESS'] }] }, '$grandTotal', 0] } },
        cod: { $sum: { $cond: [{ $eq: ['$paymentMethod', 'COD'] }, 1, 0] } },
        delivered: { $sum: { $cond: [{ $eq: ['$orderStatus', 'Delivered'] }, 1, 0] } }
      }
    }
  ]);

  const r = rows[0] || { orders: 0, revenue: 0, cod: 0, delivered: 0 };

  return { orders: r.orders, revenue: r.revenue, cod: r.cod, online: r.orders - r.cod, delivered: r.delivered };
}

async function collect(deps, now) {
  const { Order, Product, User } = deps.models;
  const end = startOfTodayIST(now);
  const start = new Date(end - 7 * DAY);
  const prevStart = new Date(start - 7 * DAY);

  const [cur, prev, top, newCustomers, low] = await Promise.all([
    weekNumbers(Order, start, end),
    weekNumbers(Order, prevStart, start),
    Order.aggregate([
      { $match: { ...REAL, createdAt: { $gte: start, $lt: end } } },
      { $unwind: '$items' },
      { $group: { _id: '$items.name', qty: { $sum: '$items.quantity' }, sales: { $sum: { $multiply: ['$items.quantity', '$items.unitPrice'] } } } },
      { $sort: { qty: -1 } },
      { $limit: 5 }
    ]),
    User.countDocuments({ createdAt: { $gte: start, $lt: end } }),
    Product.find({ isActive: true, stock: { $lte: 5 } }).select('name stock').sort({ stock: 1 }).limit(8).lean()
  ]);

  return { start, end, cur, prev, top, newCustomers, low };
}

const change = (a, b) => {
  if (!b) return a ? 'naya' : '-';

  const p = Math.round(((a - b) / b) * 100);

  return `${p > 0 ? '+' : ''}${p}%`;
};

function buildHtml(d) {
  const { cur, prev } = d;
  const day = x => new Date(x).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
  const avg = cur.orders ? cur.revenue / cur.orders : 0;

  const row = (label, a, b, fmt = String) =>
    `<tr><td style="padding:6px 10px">${label}</td><td style="padding:6px 10px"><b>${fmt(a)}</b></td><td style="padding:6px 10px;color:#7a6a5d">pichhle hafte ${fmt(b)} (${change(a, b)})</td></tr>`;

  return `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#302117;max-width:560px">
    <h2 style="margin:0 0 4px">📈 Hafte ka summary</h2>
    <p style="margin:0 0 12px;color:#7a6a5d">${day(d.start)} se ${day(new Date(d.end - 1))}</p>
    <table style="border-collapse:collapse;width:100%;background:#fffaf3;border:1px solid #ecdcc8">
      ${row('Orders', cur.orders, prev.orders)}
      ${row('Bikri (sales)', cur.revenue, prev.revenue, rs)}
      ${row('Delivered', cur.delivered, prev.delivered)}
      <tr><td style="padding:6px 10px">Average order</td><td style="padding:6px 10px"><b>${rs(avg)}</b></td><td></td></tr>
      <tr><td style="padding:6px 10px">COD / Online</td><td style="padding:6px 10px"><b>${cur.cod} / ${cur.online}</b></td><td></td></tr>
      <tr><td style="padding:6px 10px">Naye customers</td><td style="padding:6px 10px"><b>${d.newCustomers}</b></td><td></td></tr>
    </table>
    <h3 style="margin:16px 0 6px">🏆 Sabse zyada bikne wale</h3>
    ${d.top.length ? '<ol style="margin:0;padding-left:20px">' + d.top.map(t => `<li>${esc(t._id)} (${t.qty} piece, ${rs(t.sales)})</li>`).join('') + '</ol>' : '<p style="margin:0">Is hafte koi order nahi aaya.</p>'}
    <h3 style="margin:16px 0 6px">⚠️ Kam stock (5 ya kam)</h3>
    ${d.low.length ? '<ul style="margin:0;padding-left:20px">' + d.low.map(p => `<li>${esc(p.name)}: ${p.stock} bacha</li>`).join('') + '</ul>' : '<p style="margin:0">Sab products me stock theek hai.</p>'}
    <p style="margin-top:18px;color:#7a6a5d;font-size:13px">Bikri me sirf wahi orders hain jinka paisa aaya ya jo COD hain, aur cancel nahi hue. Ye email band karne ke liye Admin → Store Settings dekho.</p>
  </div>`;
}

async function sweepWeeklySummary(deps = defaultDeps(), now = new Date()) {
  const { SiteSettings, settings, mail } = deps;
  const config = settings.peek();

  if (!config.weeklySummaryEnabled || !mail.mailConfigured()) return { sent: false };

  const to = config.email || process.env.ADMIN_ALERT_EMAIL;

  if (!to) return { sent: false };

  const t = istParts(now);

  // Monday, 9am India time or later (the job runs every few minutes).
  if (t.day !== 1 || t.hour < 9) return { sent: false };

  const row = await SiteSettings.findOne({ key: 'main' }).select('lastWeeklySummaryAt').lean();

  if (row && row.lastWeeklySummaryAt && now - new Date(row.lastWeeklySummaryAt) < MIN_GAP) return { sent: false };

  // claim the slot first so two servers do not both send
  await SiteSettings.updateOne({ key: 'main' }, { $set: { lastWeeklySummaryAt: now } }, { upsert: true });

  try {
    const data = await collect(deps, now);

    await mail.sendMail({ to, subject: `Memora: hafte ka summary (${data.cur.orders} orders, ${rs(data.cur.revenue)})`, html: buildHtml(data) });

    return { sent: true };
  } catch (err) {
    await SiteSettings.updateOne({ key: 'main' }, { $set: { lastWeeklySummaryAt: row && row.lastWeeklySummaryAt ? row.lastWeeklySummaryAt : null } });
    throw err;
  }
}

module.exports = { sweepWeeklySummary, buildHtml, startOfTodayIST, istParts, change, MIN_GAP };
