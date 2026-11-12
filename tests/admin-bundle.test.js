'use strict';

const test = require('node:test');
const assert = require('node:assert');
const Module = require('node:module');

const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (request === 'mongoose') return { isValidObjectId: v => /^[a-f0-9]{24}$/i.test(String(v)), Schema: function () {}, model: () => ({}) };
  return origLoad.call(this, request, ...rest);
};
const { staffGuard } = require('../backend/middleware/staffGuard');
const { riskOf } = require('../backend/services/codRisk');
const customers = require('../backend/controllers/adminCustomersController');
const sale = require('../backend/services/saleService');
const backup = require('../backend/services/backupService');
Module._load = origLoad;

const ID = 'a'.repeat(24);
const run = (role, method, path) => {
  let out = 'next';
  const res = { status(c) { out = c; return this; }, json(b) { out = out === 'next' ? 'json:' + JSON.stringify(b).slice(0, 40) : out; return this; } };
  staffGuard({ admin: { role }, method, path }, res, () => { out = 'next'; });
  return out;
};

/* ---------- staff ---------- */
test('owner passes everywhere; staff only the packing work', () => {
  assert.strictEqual(run('admin', 'GET', '/settings'), 'next');
  assert.strictEqual(run('staff', 'GET', '/orders'), 'next');
  assert.strictEqual(run('staff', 'PUT', `/orders/${ID}`), 'next');
  assert.strictEqual(run('staff', 'POST', `/orders/${ID}/create-shipment`), 'next');
  assert.strictEqual(run('staff', 'GET', `/orders/${ID}/invoice`), 'next');
  assert.strictEqual(run('staff', 'GET', '/return-requests'), 'next');
});

test('staff are blocked from money, customers, settings, products, staff, backup', () => {
  for (const [m, p] of [
    ['GET', '/settings'], ['PUT', '/settings'], ['GET', '/payments'], ['POST', `/payments/${ID}/refund`],
    ['GET', '/users'], ['GET', '/customers/export'], ['GET', '/reports'], ['GET', '/backup/download'],
    ['GET', '/staff'], ['POST', '/staff'], ['POST', '/products'], ['DELETE', `/products/${ID}`],
    ['POST', `/orders/${ID}/cod/paid`], ['POST', `/orders/${ID}/cashfree/refunds/initiate`],
    ['POST', '/sale'], ['GET', '/coupons'], ['GET', '/test-orders'], ['POST', '/test-orders/delete']
  ]) assert.strictEqual(run('staff', m, p), 403, `${m} ${p}`);
});

test('staff login check gets an empty dashboard, not sales numbers', () => {
  assert.match(run('staff', 'GET', '/dashboard'), /json:.*"dashboard":\{\}/);
});

/* ---------- COD risk ---------- */
const order = { paymentMethod: 'COD', grandTotal: 800, shippingAddress: { addressLine: 'House 12, Gomti Nagar, Lucknow' } };

test('risk: new COD customer is only a light warning, trusted repeat customer is clean', () => {
  assert.strictEqual(riskOf(order, []).level, 'MEDIUM');
  const trusted = riskOf(order, [{ orderStatus: 'Delivered' }, { orderStatus: 'Delivered' }]);
  assert.strictEqual(trusted.level, 'LOW');
  assert.strictEqual(trusted.trusted, true);
});

test('risk: earlier cancels/returns + big COD + short address = HIGH', () => {
  const r = riskOf({ ...order, grandTotal: 3500, shippingAddress: { addressLine: 'near temple' } },
    [{ orderStatus: 'Cancelled' }, { orderStatus: 'Cancelled' }, { orderStatus: 'Delivered', returnRequest: { status: 'APPROVED' } }]);
  assert.strictEqual(r.level, 'HIGH');
  assert.ok(r.reasons.length >= 3);
});

test('risk: prepaid order with clean history is LOW', () => {
  assert.strictEqual(riskOf({ ...order, paymentMethod: 'CASHFREE' }, [{ orderStatus: 'Delivered' }]).level, 'LOW');
});

/* ---------- customers ---------- */
test('customer summary counts repeat buyers; CSV neutralises formulas', () => {
  const list = [
    { name: 'Asha', mobile: '9', email: 'a@x', orders: 3, spent: 3000, lastOrderAt: new Date('2026-11-01'), joinedAt: new Date('2026-10-01') },
    { name: '=HYPERLINK("x")', mobile: '8', email: 'b@x', orders: 1, spent: 500 }
  ];
  const s = customers.summarise(list);
  assert.deepStrictEqual([s.buyers, s.repeatBuyers, s.repeatRate, s.totalSpent], [2, 1, 50, 3500]);
  const csv = customers.toCsv(list);
  assert.ok(csv.includes(`"'=HYPERLINK(""x"")"`));
  assert.ok(csv.includes('"Total spent (INR)"'));
});

/* ---------- festival sale ---------- */
const product = {
  sellingPrice: 1000, originalPrice: 1200,
  variants: [{ price: 500, originalPrice: undefined }, { price: undefined }]
};

test('sale lowers prices and keeps the old ones; restore puts them back exactly', () => {
  const set = sale.saleUpdate(product, 20);
  assert.strictEqual(set.sellingPrice, 800);
  assert.strictEqual(set.originalPrice, 1200);                  // crossed-out price stays the higher one
  assert.strictEqual(set['variants.0.price'], 400);
  assert.strictEqual(set['variants.1.price'], undefined);       // option without own price untouched
  assert.deepStrictEqual(set['sale.saved'].sellingPrice, 1000);

  const back = sale.restoreUpdate({ variants: product.variants, sale: { saved: set['sale.saved'] } });
  assert.strictEqual(back.$set.sellingPrice, 1000);
  assert.strictEqual(back.$set.originalPrice, 1200);
  assert.strictEqual(back.$set['variants.0.price'], 500);
  assert.ok('variants.0.originalPrice' in back.$unset);          // it did not exist before
  assert.ok('sale' in back.$unset);
});

test('sale without an original price: crossed-out price is the old selling price, then removed', () => {
  const p = { sellingPrice: 500, variants: [] };
  const set = sale.saleUpdate(p, 10);
  assert.strictEqual(set.originalPrice, 500);
  assert.strictEqual(set.sellingPrice, 450);
  const back = sale.restoreUpdate({ variants: [], sale: { saved: set['sale.saved'] } });
  assert.ok('originalPrice' in back.$unset);
});

test('sweeper starts due sales once and ends finished ones', async () => {
  const updates = [];
  const now = new Date('2026-11-12T10:00:00Z');
  let call = 0;
  const Product = {
    find: () => {
      call += 1;
      const rows = call === 1
        ? [{ _id: 1, sellingPrice: 1000, variants: [], sale: { percent: 10, startsAt: new Date('2026-11-12'), endsAt: new Date('2026-11-20') } }]
        : [{ _id: 2, variants: [], sale: { applied: true, saved: { sellingPrice: 700, originalPrice: null, variants: [] } } },
           { _id: 3, variants: [], sale: { applied: false } }];
      const q = { limit: () => q, select: () => q, lean: async () => rows };
      return q;
    },
    updateOne: async (f, u) => { updates.push({ f, u }); return { modifiedCount: 1 }; }
  };
  const r = await sale.sweepSales(Product, now);
  assert.deepStrictEqual(r, { started: 1, ended: 2 });
  assert.strictEqual(updates[0].u.$set.sellingPrice, 900);
  assert.strictEqual(updates[0].f['sale.applied'].$ne, true);        // idempotent
  assert.strictEqual(updates[1].u.$set.sellingPrice, 700);
  assert.deepStrictEqual(updates[2].u, { $unset: { sale: 1 } });
});

/* ---------- backup ---------- */
test('daily backup: off by default, once per day, claims the slot, attaches gzip', async () => {
  const sent = [];
  const slot = [];
  const mk = (enabled, last) => ({
    models: {
      Order: { find: () => ({ sort: () => ({ limit: () => ({ lean: async () => [{ orderId: 'MC1' }] }) }) }) },
      Product: { find: () => ({ limit: () => ({ lean: async () => [] }) }) },
      Category: { find: () => ({ lean: async () => [] }) },
      User: { find: () => ({ select: () => ({ limit: () => ({ lean: async () => [{ fullName: 'A' }] }) }) }) },
      Coupon: { find: () => ({ limit: () => ({ lean: async () => [] }) }) },
      Review: { find: () => ({ limit: () => ({ lean: async () => [] }) }) }
    },
    SiteSettings: {
      findOne: () => ({ select: () => ({ lean: async () => ({ lastBackupEmailAt: last }) }), lean: async () => ({ key: 'main' }) }),
      updateOne: async (f, u) => { slot.push(u); }
    },
    settings: { peek: () => ({ backupEmailEnabled: enabled, email: 'owner@x.com' }) },
    mail: { mailConfigured: () => true, sendMail: async m => { sent.push(m); } }
  });
  const now = new Date('2026-11-12T10:00:00Z');

  assert.deepStrictEqual(await backup.sweepBackup(mk(false, null), now), { sent: false });
  assert.deepStrictEqual(await backup.sweepBackup(mk(true, new Date('2026-11-12T02:00:00Z')), now), { sent: false });
  assert.strictEqual(sent.length, 0);

  const r = await backup.sweepBackup(mk(true, new Date('2026-11-10T02:00:00Z')), now);
  assert.strictEqual(r.sent, true);
  assert.strictEqual(sent[0].to, 'owner@x.com');
  assert.match(sent[0].attachments[0].name, /memora-backup-2026-11-12\.json\.gz/);
  assert.ok(slot[0].$set.lastBackupEmailAt);
  const json = require('zlib').gunzipSync(Buffer.from(sent[0].attachments[0].contentBase64, 'base64')).toString();
  assert.ok(!/passwordHash/.test(json));
  assert.strictEqual(JSON.parse(json).counts.orders, 1);
});
