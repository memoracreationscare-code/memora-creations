const test = require('node:test');
const assert = require('node:assert');
const sweeper = require('../backend/services/pushSweeper');
const pushService = require('../backend/services/pushService');

const chain = rows => {
  const c = { sort: () => c, limit: () => c, select: () => c, lean: async () => rows, then: undefined };
  return c;
};

function makeDeps({ orders = [], carts = [], users = [], subs = [], admin = false }) {
  const sent = [];
  const claimed = [];
  const allSubs = subs.concat(admin ? [{ role: 'admin', createdAt: new Date('2026-01-01') }] : []);
  return {
    sent,
    claimed,
    Order: {
      find: () => chain(orders),
      updateOne: async (q, u) => { claimed.push(u.$addToSet.pushSent); return { modifiedCount: 1 }; },
      exists: async () => null
    },
    Cart: { find: () => chain(carts), updateOne: async () => ({ modifiedCount: 1 }) },
    User: { find: () => chain(users), updateOne: async () => ({}) },
    PushSubscription: {
      exists: async q => (q && q.role === 'admin' ? admin : q && q.user ? allSubs.some(s => String(s.user) === String(q.user)) : allSubs.length > 0) || null,
      find: q => chain(q && q.role === 'admin' ? allSubs.filter(s => s.role === 'admin') : allSubs.filter(s => s.role !== 'admin'))
    },
    push: { notify: async m => { sent.push(m); return {}; } }
  };
}

const NOW = new Date('2026-11-16T10:00:00+05:30');

test('customer gets one push for a shipped order, not for old updates', async () => {
  const deps = makeDeps({
    subs: [{ role: 'customer', user: 'u1', createdAt: new Date('2026-11-10') }],
    orders: [
      { _id: 'o1', orderId: 'MC-1', user: 'u1', orderStatus: 'Shipped', paymentStatus: 'SUCCESS', createdAt: new Date('2026-11-14'), updatedAt: new Date('2026-11-15') },
      { _id: 'o2', orderId: 'MC-2', user: 'u1', orderStatus: 'Shipped', paymentStatus: 'SUCCESS', createdAt: new Date('2026-11-01'), updatedAt: new Date('2026-11-05') }
    ]
  });
  await sweeper.sweepPush(deps, NOW);
  const mine = deps.sent.filter(m => m.kind === 'user');
  assert.equal(mine.length, 1);
  assert.match(mine[0].body, /MC-1/);
  assert.deepEqual(deps.claimed, ['P_SHIPPED']);
});

test('unpaid online order sends nothing', () => {
  assert.equal(sweeper.customerEvent({ orderStatus: 'Pending', paymentStatus: 'PENDING', paymentMethod: 'ONLINE' }), null);
  assert.equal(sweeper.customerEvent({ orderStatus: 'Pending', paymentStatus: 'COD_PENDING', paymentMethod: 'COD' }), 'ORDER_PLACED');
  assert.equal(sweeper.customerEvent({ orderStatus: 'Cancelled', paymentStatus: 'PENDING', paymentMethod: 'ONLINE' }), null);
});

test('admin phone gets a new-order push with the amount', async () => {
  const deps = makeDeps({
    admin: true,
    orders: [{ _id: 'o3', orderId: 'MC-3', user: 'u9', orderStatus: 'Pending', paymentStatus: 'SUCCESS', grandTotal: 1499, createdAt: new Date('2026-11-16T09:00:00+05:30'), updatedAt: new Date('2026-11-16T09:00:00+05:30') }]
  });
  await sweeper.sweepPush(deps, NOW);
  const a = deps.sent.filter(m => m.kind === 'admin');
  assert.equal(a.length, 1);
  assert.match(a[0].body, /MC-3/);
  assert.match(a[0].body, /1,499/);
});

test('abandoned cart push goes only to a customer with a saved phone', async () => {
  const cart = { _id: 'c1', user: 'u1', items: [{}, {}], updatedAt: new Date('2026-11-16T03:00:00+05:30') };
  const withPhone = makeDeps({ subs: [{ role: 'customer', user: 'u1', createdAt: new Date('2026-11-01') }], carts: [cart] });
  await sweeper.sweepPush(withPhone, NOW);
  assert.equal(withPhone.sent.filter(m => /cart/i.test(m.title)).length, 1);

  const noPhone = makeDeps({ subs: [{ role: 'customer', user: 'u2', createdAt: new Date('2026-11-01') }], carts: [cart] });
  await sweeper.sweepPush(noPhone, NOW);
  assert.equal(noPhone.sent.filter(m => /cart/i.test(m.title)).length, 0);
});

test('birthday greeting is sent after 9am IST on the day', async () => {
  const deps = makeDeps({
    subs: [{ role: 'customer', user: 'u1', createdAt: new Date('2026-11-01') }],
    users: [{ _id: 'u1', fullName: 'Rahul Kumar' }]
  });
  await sweeper.sweepPush(deps, NOW);
  assert.equal(deps.sent.filter(m => /Birthday/.test(m.title)).length, 1);
  assert.match(deps.sent.find(m => /Birthday/.test(m.title)).title, /Rahul/);

  const early = makeDeps({ subs: [{ role: 'customer', user: 'u1', createdAt: new Date('2026-11-01') }], users: [{ _id: 'u1', fullName: 'Rahul' }] });
  await sweeper.sweepPush(early, new Date('2026-11-16T06:00:00+05:30'));
  assert.equal(early.sent.filter(m => /Birthday/.test(m.title)).length, 0);
});

test('nothing runs when nobody allowed notifications', async () => {
  const deps = makeDeps({});
  assert.equal(await sweeper.sweepPush(deps, NOW), null);
});

test('each phone only gets messages it has not seen', async () => {
  const msgs = [
    { kind: 'broadcast', title: 'A', createdAt: new Date('2026-11-16T01:00:00Z') },
    { kind: 'user', user: 'u1', title: 'B', createdAt: new Date('2026-11-16T02:00:00Z') },
    { kind: 'user', user: 'u2', title: 'C', createdAt: new Date('2026-11-16T03:00:00Z') },
    { kind: 'admin', title: 'D', createdAt: new Date('2026-11-16T04:00:00Z') }
  ];
  const sub = { endpoint: 'https://p/1', role: 'customer', user: 'u1', lastSeenAt: new Date('2026-11-15') };
  const deps = {
    PushSubscription: {
      findOne: () => ({ lean: async () => ({ ...sub }) }),
      updateOne: async (_q, u) => { sub.lastSeenAt = u.$set.lastSeenAt; }
    },
    PushMessage: {
      findOne: q => ({
        sort: () => ({
          lean: async () => msgs
            .filter(m => m.createdAt > q.createdAt.$gt && q.$or.some(o => o.kind === m.kind && (!o.user || o.user === m.user)))
            .sort((a, b) => a.createdAt - b.createdAt)[0] || null
        })
      })
    }
  };
  const seen = [];
  for (let i = 0; i < 4; i++) {
    const m = await pushService.nextMessageFor('https://p/1', deps);
    seen.push(m ? m.title : null);
  }
  assert.deepEqual(seen, ['A', 'B', null, null]);
});

test('IST helper, server wiring, profile birthday and gift guide', () => {
  const t = sweeper.istParts(new Date('2026-11-16T20:00:00Z'));
  assert.equal(t.md, '11-17');
  assert.equal(t.hour, 1);
  const fs = require('fs');
  const root = __dirname + '/../';
  assert.match(fs.readFileSync(root + 'backend/server.js', 'utf8'), /startPushSweeper/);
  assert.match(fs.readFileSync(root + 'frontend/sw.js', 'utf8'), /push\/latest' \+ q/);
  assert.match(fs.readFileSync(root + 'frontend/js/profile.js', 'utf8'), /bdMonth/);
  assert.match(fs.readFileSync(root + 'backend/controllers/profileController.js', 'utf8'), /Birthday sahi nahi/);
  assert.match(fs.readFileSync(root + 'sitemap.xml', 'utf8'), /gift-guide\.html/);
});
