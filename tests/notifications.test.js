'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { sweepNotifications, wantedEvents } = require('../backend/services/notificationSweeper');
const templates = require('../backend/utils/emailTemplates');

const now = new Date('2026-11-12T10:00:00Z');

test('which email each status needs', () => {
  const base = { paymentStatus: 'SUCCESS', paymentMethod: 'CASHFREE' };
  assert.deepStrictEqual(wantedEvents({ ...base, orderStatus: 'Order Placed' }), ['ORDER_PLACED']);
  assert.deepStrictEqual(wantedEvents({ ...base, orderStatus: 'Shipped' }), ['SHIPPED']);
  assert.deepStrictEqual(wantedEvents({ ...base, orderStatus: 'Delivered', notificationsSent: ['DELIVERED'] }), []);
  assert.deepStrictEqual(
    wantedEvents({ ...base, orderStatus: 'Cancelled', refund: { status: 'REFUNDED' } }),
    ['CANCELLED', 'REFUNDED']
  );
});

test('no email for a never-paid online order, nor for an unpaid pending one', () => {
  assert.deepStrictEqual(wantedEvents({ orderStatus: 'Cancelled', paymentMethod: 'CASHFREE', paymentStatus: 'CANCELLED' }), []);
  assert.deepStrictEqual(wantedEvents({ orderStatus: 'Order Placed', paymentMethod: 'CASHFREE', paymentStatus: 'PENDING' }), []);
  assert.deepStrictEqual(wantedEvents({ orderStatus: 'Cancelled', paymentMethod: 'COD', paymentStatus: 'CANCELLED' }), ['CANCELLED']);
});

function deps({ enabled = true, configured = true, orders = [], carts = [] } = {}) {
  const log = [];
  return {
    log,
    Order: {
      find: () => ({ sort: () => ({ limit: () => ({ populate: async () => orders }) }) }),
      updateOne: async (f, u) => {
        const o = orders.find(x => String(x._id) === String(f._id));
        if (u.$addToSet) { o.notificationsSent = [...(o.notificationsSent || []), u.$addToSet.notificationsSent]; return { modifiedCount: 1 }; }
        return { modifiedCount: 0 };
      },
      aggregate: async () => []
    },
    Cart: {
      find: () => ({ sort: () => ({ limit: () => ({ populate: () => ({ populate: () => ({ lean: async () => carts }) }) }) }) }),
      updateOne: async () => ({ modifiedCount: 1 })
    },
    settings: { peek: () => ({
      emailNotificationsEnabled: enabled, emailNotificationsSince: '2026-11-01T00:00:00Z',
      abandonedReminderEnabled: enabled, abandonedReminderSince: '2026-11-01T00:00:00Z', abandonedReminderHours: 24
    }) },
    mail: { mailConfigured: () => configured, sendMail: async m => { log.push(m.to + '|' + m.subject); } },
    templates,
    abandoned: require('../backend/utils/abandonedCarts')
  };
}

const order = extra => ({
  _id: 'o1', orderId: 'MC-1', orderStatus: 'Shipped', paymentStatus: 'SUCCESS', paymentMethod: 'CASHFREE',
  grandTotal: 499, items: [{ name: 'Lamp', quantity: 1, unitPrice: 499, lineTotal: 499 }],
  shippingAddress: { fullName: 'Ram Kumar' }, user: { email: 'ram@example.com' }, ...extra
});

test('sends one email per event and never twice', async () => {
  const d = deps({ orders: [order()] });
  await sweepNotifications(d, now);
  await sweepNotifications(d, now);
  assert.strictEqual(d.log.length, 1);
  assert.match(d.log[0], /ram@example.com\|Your order MC-1 is on its way/);
});

test('sends nothing when switched off or no email service', async () => {
  let d = deps({ enabled: false, orders: [order()] });
  await sweepNotifications(d, now);
  assert.strictEqual(d.log.length, 0);
  d = deps({ configured: false, orders: [order()] });
  await sweepNotifications(d, now);
  assert.strictEqual(d.log.length, 0);
});

test('abandoned cart gets one reminder with its items', async () => {
  const cart = {
    _id: 'c1', updatedAt: new Date('2026-11-11T02:00:00Z'),
    user: { _id: 'u1', fullName: 'Sita Devi', email: 'sita@example.com', isActive: true },
    items: [{ quantity: 2, product: { name: 'Vase', sellingPrice: 300, stock: 5, isActive: true } }]
  };
  const d = deps({ carts: [cart] });
  const r = await sweepNotifications(d, now);
  assert.strictEqual(r.carts.sent, 1);
  assert.match(d.log[0], /sita@example.com\|You left something in your cart/);
});

test('email text is escaped and has the order link', () => {
  const m = templates.orderEmail('DELIVERED', order({ shippingAddress: { fullName: '<b>X</b>' } }));
  assert.ok(!m.html.includes('<b>X</b>'));
  assert.ok(m.html.includes('order-details.html?id=o1'));
});
