'use strict';

/*
  Automatic customer emails (every 3 minutes), no clicking needed:

    ORDER_PLACED, SHIPPED, OUT_FOR_DELIVERY, DELIVERED, CANCELLED, REFUNDED
    and one reminder for an abandoned cart.

  It reads the order status the other automatic jobs already keep up to
  date, so no other code had to change. Each email is sent only once per
  order (notificationsSent). Only orders/carts newer than the moment the
  owner switched the option on in Store Settings are used.
  Needs an email service: see services/mailService.js.
*/

const BATCH = 15;

const STATUS_EVENT = {
  Shipped: 'SHIPPED',
  'Out for Delivery': 'OUT_FOR_DELIVERY',
  Delivered: 'DELIVERED',
  Cancelled: 'CANCELLED'
};

function defaultDeps() {
  const models = require('../models');

  return {
    Order: models.Order,
    Cart: models.Cart,
    settings: require('./settingsService'),
    mail: require('./mailService'),
    templates: require('../utils/emailTemplates'),
    abandoned: require('../utils/abandonedCarts')
  };
}

// Which email an order needs right now (never an old one it has passed).
function wantedEvents(order) {
  const events = [];
  const paid = order.paymentStatus === 'SUCCESS' || order.paymentStatus === 'COD_PENDING';

  if (order.orderStatus === 'Cancelled') {
    // Never email about an online order that was never paid (abandoned checkout).
    if (order.paymentMethod === 'COD' || order.paymentStatus === 'SUCCESS') events.push('CANCELLED');
  } else if (STATUS_EVENT[order.orderStatus]) {
    events.push(STATUS_EVENT[order.orderStatus]);
  } else if (paid) {
    events.push('ORDER_PLACED');
  }

  if (order.refund && order.refund.status === 'REFUNDED') events.push('REFUNDED');

  return events.filter(e => !(order.notificationsSent || []).includes(e));
}

async function sweepOrderEmails(deps, now) {
  const { Order, settings, mail, templates } = deps;
  const s = settings.peek();
  const since = s.emailNotificationsSince ? new Date(s.emailNotificationsSince) : null;
  const result = { sent: 0, failed: 0 };

  if (!s.emailNotificationsEnabled || !since || !mail.mailConfigured()) return result;

  const orders = await Order.find({
    createdAt: { $gte: since },
    updatedAt: { $gte: new Date(now.getTime() - 3 * 86400000) }
  })
    .sort({ updatedAt: -1 })
    .limit(60)
    .populate('user', 'email fullName');

  for (const order of orders) {
    const email = order.user && order.user.email;

    if (!email) continue;

    for (const event of wantedEvents(order)) {
      if (result.sent + result.failed >= BATCH) return result;

      // Claim the email first so a restart can never send it twice.
      const claimed = await Order.updateOne(
        { _id: order._id, notificationsSent: { $ne: event } },
        { $addToSet: { notificationsSent: event } },
        { timestamps: false }
      );

      if (!claimed.modifiedCount) continue;

      try {
        const message = templates.orderEmail(event, order);

        await mail.sendMail({ to: email, subject: message.subject, html: message.html });
        result.sent += 1;
      } catch (err) {
        result.failed += 1;
        // Allow one retry on the next round.
        await Order.updateOne(
          { _id: order._id },
          { $pull: { notificationsSent: event } },
          { timestamps: false }
        );
        console.warn('[Email]', order.orderId, event, err.message);
      }
    }
  }

  return result;
}

async function sweepCartReminders(deps, now) {
  const { Order, Cart, settings, mail, templates, abandoned } = deps;
  const s = settings.peek();
  const since = s.abandonedReminderSince ? new Date(s.abandonedReminderSince) : null;
  const result = { sent: 0, failed: 0 };

  if (!s.abandonedReminderEnabled || !since || !mail.mailConfigured()) return result;

  const hours = abandoned.clampMinHours(s.abandonedReminderHours);
  const newest = new Date(now.getTime() - hours * 3600000);
  const oldest = new Date(Math.max(since.getTime(), now.getTime() - 3 * 86400000));

  const carts = await Cart.find({
    'items.0': { $exists: true },
    updatedAt: { $lte: newest, $gte: oldest },
    $or: [{ reminderSentAt: null }, { reminderSentAt: { $exists: false } }]
  })
    .sort({ updatedAt: 1 })
    .limit(30)
    .populate({ path: 'user', select: 'fullName email mobile isActive' })
    .populate({ path: 'items.product', select: 'name sellingPrice stock isActive' })
    .lean();

  const userIds = carts.map(c => c.user && c.user._id).filter(Boolean);
  const latest = userIds.length
    ? await Order.aggregate([
        { $match: { user: { $in: userIds } } },
        { $group: { _id: '$user', last: { $max: '$createdAt' } } }
      ])
    : [];

  const rows = abandoned.buildAbandonedCarts({
    carts,
    latestOrderByUser: new Map(latest.map(r => [String(r._id), r.last])),
    minHours: hours,
    now
  });

  for (const row of rows) {
    if (result.sent + result.failed >= 10) break;

    if (!row.email) continue;

    // timestamps:false keeps the cart "untouched" so it is not counted as new activity.
    const claimed = await Cart.updateOne(
      { _id: row.cartId, $or: [{ reminderSentAt: null }, { reminderSentAt: { $exists: false } }] },
      { $set: { reminderSentAt: now } },
      { timestamps: false }
    );

    if (!claimed.modifiedCount) continue;

    try {
      const message = templates.cartReminderEmail(row);

      await mail.sendMail({ to: row.email, subject: message.subject, html: message.html });
      result.sent += 1;
    } catch (err) {
      result.failed += 1;
      await Cart.updateOne({ _id: row.cartId }, { $unset: { reminderSentAt: 1 } }, { timestamps: false });
      console.warn('[Cart reminder]', err.message);
    }
  }

  return result;
}

async function sweepNotifications(deps = defaultDeps(), now = new Date()) {
  return {
    orders: await sweepOrderEmails(deps, now),
    carts: await sweepCartReminders(deps, now)
  };
}

let timer = null;

function startNotificationSweeper() {
  if (timer) return;

  const run = async () => {
    try {
      await require('./lowStockAlert').sweepLowStock().catch(err => console.warn('[Low stock]', err.message));

      const r = await sweepNotifications();

      if (r.orders.sent || r.carts.sent || r.orders.failed || r.carts.failed) {
        console.log('[Notifications]', JSON.stringify(r));
      }
    } catch (err) {
      console.warn('[Notifications] failed:', err.message);
    }
  };

  setTimeout(run, 100 * 1000).unref();
  timer = setInterval(run, 3 * 60 * 1000);
  timer.unref();
}

module.exports = { sweepNotifications, wantedEvents, startNotificationSweeper };
