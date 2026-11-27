'use strict';

/*
  Automatic phone notifications (every 3 minutes). Each one is sent once.

  Customers (only those who allowed notifications while logged in):
    order placed / shipped / out for delivery / delivered / cancelled,
    a reminder for a cart left behind, and a birthday greeting.
  Admin phones:
    a new paid order, and a short sales summary every evening.
*/

const STATUS_EVENT = {
  Shipped: 'SHIPPED',
  'Out for Delivery': 'OUT_FOR_DELIVERY',
  Delivered: 'DELIVERED',
  Cancelled: 'CANCELLED'
};

const TEXT = {
  ORDER_PLACED: o => ['Order mil gaya 🎉', `Aapka order ${o.orderId} confirm ho gaya hai. Hum jaldi pack karke bhejenge.`],
  SHIPPED: o => ['Order ship ho gaya 🚚', `Aapka order ${o.orderId} bhej diya gaya hai.`],
  OUT_FOR_DELIVERY: o => ['Aaj delivery hogi 📦', `Aapka order ${o.orderId} aaj aapke paas pahunchega.`],
  DELIVERED: o => ['Order deliver ho gaya ✅', `Aapka order ${o.orderId} deliver ho gaya. Hume bataiye kaisa laga!`],
  CANCELLED: o => ['Order cancel ho gaya', `Aapka order ${o.orderId} cancel ho gaya hai.`]
};

function defaultDeps() {
  const models = require('../models');

  return {
    Order: models.Order,
    Cart: models.Cart,
    User: models.User,
    PushSubscription: require('../models/PushSubscription'),
    push: require('./pushService'),
    settings: require('./settingsService')
  };
}

function isPaid(order) {
  return order.paymentStatus === 'SUCCESS' || order.paymentStatus === 'COD_PENDING';
}

function customerEvent(order) {
  if (order.orderStatus === 'Cancelled') {
    return order.paymentMethod === 'COD' || order.paymentStatus === 'SUCCESS' ? 'CANCELLED' : null;
  }
  if (STATUS_EVENT[order.orderStatus]) return STATUS_EVENT[order.orderStatus];
  return isPaid(order) ? 'ORDER_PLACED' : null;
}

async function claim(Order, order, tag) {
  const res = await Order.updateOne(
    { _id: order._id, pushSent: { $ne: tag } },
    { $addToSet: { pushSent: tag } },
    { timestamps: false }
  );
  return !!res.modifiedCount;
}

async function sweepOrders(deps, now) {
  const { Order, PushSubscription, push } = deps;
  const result = { customer: 0, admin: 0 };

  const adminSince = await PushSubscription.find({ role: 'admin' }).sort({ createdAt: 1 }).limit(1).lean();
  const orders = await Order.find({ updatedAt: { $gte: new Date(now.getTime() - 2 * 86400000) } })
    .sort({ updatedAt: -1 })
    .limit(40)
    .lean();

  const userIds = [...new Set(orders.map(o => o.user && String(o.user)).filter(Boolean))];
  const subs = userIds.length
    ? await PushSubscription.find({ role: 'customer', user: { $in: userIds } }).select('user createdAt').lean()
    : [];
  const firstSub = new Map();

  subs.forEach(s => {
    const k = String(s.user);
    const t = new Date(s.createdAt).getTime();
    if (!firstSub.has(k) || t < firstSub.get(k)) firstSub.set(k, t);
  });

  for (const order of orders) {
    const event = customerEvent(order);
    const uid = order.user && String(order.user);

    // Customer: only if their phone was saved before this update happened.
    if (event && uid && firstSub.has(uid) && new Date(order.updatedAt).getTime() >= firstSub.get(uid)) {
      const tag = 'P_' + event;

      if (!(order.pushSent || []).includes(tag) && (await claim(Order, order, tag))) {
        const [title, body] = TEXT[event](order);
        await push.notify({ kind: 'user', userId: order.user, title, body, url: '/frontend/orders.html' }, deps).catch(() => {});
        result.customer += 1;
      }
    }

    // Admin: a new paid order, only after an admin phone was added.
    if (
      adminSince.length &&
      isPaid(order) &&
      order.orderStatus !== 'Cancelled' &&
      new Date(order.createdAt).getTime() >= new Date(adminSince[0].createdAt).getTime() &&
      !(order.pushSent || []).includes('P_ADMIN_NEW') &&
      (await claim(Order, order, 'P_ADMIN_NEW'))
    ) {
      const amount = Number(order.grandTotal || 0);
      await push.notify({
        kind: 'admin',
        title: 'Naya order aaya 🛍️',
        body: `${order.orderId}${amount ? ' • ₹' + amount.toLocaleString('en-IN') : ''}`,
        url: '/admin/orders.html'
      }, deps).catch(() => {});
      result.admin += 1;
    }
  }

  return result;
}

async function sweepCarts(deps, now) {
  const { Cart, Order, PushSubscription, push } = deps;
  const hours = 3;
  const newest = new Date(now.getTime() - hours * 3600000);
  const oldest = new Date(now.getTime() - 2 * 86400000);
  let sent = 0;

  const carts = await Cart.find({
    'items.0': { $exists: true },
    updatedAt: { $lte: newest, $gte: oldest },
    $or: [{ reminderPushAt: null }, { reminderPushAt: { $exists: false } }]
  }).sort({ updatedAt: 1 }).limit(30).lean();

  for (const cart of carts) {
    if (sent >= 10) break;
    if (!cart.user) continue;

    const has = await PushSubscription.exists({ role: 'customer', user: cart.user });
    if (!has) continue;

    const ordered = await Order.exists({ user: cart.user, createdAt: { $gte: cart.updatedAt } });
    const claimed = await Cart.updateOne(
      { _id: cart._id, $or: [{ reminderPushAt: null }, { reminderPushAt: { $exists: false } }] },
      { $set: { reminderPushAt: now } },
      { timestamps: false }
    );
    if (!claimed.modifiedCount || ordered) continue;

    const n = (cart.items || []).length;
    await push.notify({
      kind: 'user',
      userId: cart.user,
      title: 'Aapka cart wait kar raha hai 🛒',
      body: `${n} product${n > 1 ? 's' : ''} aapke cart me hain. Order poora kar lijiye!`,
      url: '/frontend/cart.html'
    }, deps).catch(() => {});
    sent += 1;
  }

  return sent;
}

function istParts(now) {
  const ist = new Date(now.getTime() + 5.5 * 3600000);
  return {
    year: ist.getUTCFullYear(),
    md: String(ist.getUTCMonth() + 1).padStart(2, '0') + '-' + String(ist.getUTCDate()).padStart(2, '0'),
    hour: ist.getUTCHours(),
    day: ist.toISOString().slice(0, 10)
  };
}

async function sweepBirthdays(deps, now) {
  const { User, PushSubscription, push } = deps;
  const t = istParts(now);

  if (t.hour < 9) return 0;

  const users = await User.find({
    birthday: t.md,
    isActive: true,
    'parentConsent.required': { $ne: true }, // no marketing to under-18s
    birthdayPushYear: { $ne: t.year }
  }).select('_id fullName').limit(50).lean();

  let sent = 0;

  for (const u of users) {
    await User.updateOne({ _id: u._id }, { $set: { birthdayPushYear: t.year } });

    if (!(await PushSubscription.exists({ role: 'customer', user: u._id }))) continue;

    const first = String(u.fullName || '').split(' ')[0] || 'Dost';
    await push.notify({
      kind: 'user',
      userId: u._id,
      title: `Happy Birthday ${first}! 🎂`,
      body: 'Aaj apne liye ya kisi khaas ke liye koi sundar gift chun lijiye.',
      url: '/frontend/products.html'
    }, deps).catch(() => {});
    sent += 1;
  }

  return sent;
}

let lastSummaryDay = null;

async function sweepSummary(deps, now) {
  const { Order, PushSubscription, push } = deps;
  const t = istParts(now);

  if (t.hour < 21 || lastSummaryDay === t.day) return false;
  lastSummaryDay = t.day;

  if (!(await PushSubscription.exists({ role: 'admin' }))) return false;

  const start = new Date(Date.parse(t.day + 'T00:00:00+05:30'));
  const orders = await Order.find({ createdAt: { $gte: start } })
    .select('grandTotal paymentStatus orderStatus')
    .lean();

  const good = orders.filter(o => isPaid(o) && o.orderStatus !== 'Cancelled');
  const revenue = good.reduce((s, o) => s + Number(o.grandTotal || 0), 0);

  await push.notify({
    kind: 'admin',
    title: 'Aaj ka hisaab 📊',
    body: `${good.length} order • ₹${revenue.toLocaleString('en-IN')} ki bikri`,
    url: '/admin/dashboard.html'
  }, deps).catch(() => {});

  return true;
}

async function sweepPush(deps = defaultDeps(), now = new Date()) {
  const has = await deps.PushSubscription.exists({});
  if (!has) return null;

  return {
    orders: await sweepOrders(deps, now),
    carts: await sweepCarts(deps, now),
    birthdays: await sweepBirthdays(deps, now),
    summary: await sweepSummary(deps, now)
  };
}

let timer = null;

function startPushSweeper() {
  if (timer) return;

  const run = () => sweepPush().catch(err => console.warn('[Push sweep]', err.message));

  setTimeout(run, 120 * 1000).unref();
  timer = setInterval(run, 3 * 60 * 1000);
  timer.unref();
}

module.exports = { sweepPush, startPushSweeper, customerEvent, istParts };
