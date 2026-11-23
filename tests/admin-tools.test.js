'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

// The sandbox has no mongoose: small stand-ins used only while loading.
const calls = { bulk: null, groups: [] , products: [] };
const stubs = {
  mongoose: { isValidObjectId: v => /^[a-f0-9]{24}$/i.test(String(v)) },
  '../models': {
    Product: {
      find: () => ({ select: () => ({ lean: async () => calls.products }) }),
      bulkWrite: async ops => { calls.bulk = ops; }
    },
    StockAlert: { aggregate: async () => calls.groups }
  }
};
const origLoad = Module._load;
Module._load = function (request, ...rest) {
  if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
  return origLoad.call(this, request, ...rest);
};
const tools = require('../backend/controllers/adminProductToolsController');
// handlers load ../models when they run, so the stand-ins stay until the end of this file
test.after(() => { Module._load = origLoad; });
const { istDayRange, parseDay } = require('../backend/utils/dateRange');
const { ALLOWED } = require('../backend/middleware/staffGuard');

const A = 'a'.repeat(24);
const B = 'b'.repeat(24);
const prod = (id, extra = {}) => ({ _id: id, name: 'P' + id[0], stock: 5, originalPrice: 500, sellingPrice: 400, variants: [], ...extra });

/* ---------- planBulk ---------- */

test('only really changed values are written', () => {
  const plan = tools.planBulk([prod(A)], [{ id: A, stock: 5, sellingPrice: 400, originalPrice: 500 }]);
  assert.deepStrictEqual(plan.changes, []);

  const p2 = tools.planBulk([prod(A)], [{ id: A, stock: 9, sellingPrice: 350 }]);
  assert.deepStrictEqual(p2.changes[0].set, { stock: 9, sellingPrice: 350 });
});

test('bad rows are refused with the product name', () => {
  assert.throws(() => tools.planBulk([prod(A)], [{ id: A, stock: -1 }]), /stock poora number/);
  assert.throws(() => tools.planBulk([prod(A)], [{ id: A, stock: 2.5 }]), /stock poora number/);
  assert.throws(() => tools.planBulk([prod(A)], [{ id: A, sellingPrice: 600 }]), /MRP se zyada/);
  assert.throws(() => tools.planBulk([prod(A)], [{ id: A, sellingPrice: 0 }]), /daam sahi/);
  assert.throws(() => tools.planBulk([prod(A)], [{ id: A, sellingPrice: 'abc' }]), /daam sahi/);
  assert.throws(() => tools.planBulk([prod(A)], [{ id: A, stock: 1 }, { id: A, stock: 2 }]), /do baar/);
  assert.throws(() => tools.planBulk([prod(A)], [{ id: B, stock: 1 }]), /nahi mila/);
});

test('MRP and price are checked together (new MRP lower than old price)', () => {
  assert.throws(() => tools.planBulk([prod(A)], [{ id: A, originalPrice: 300 }]), /MRP se zyada/);
  const ok = tools.planBulk([prod(A)], [{ id: A, originalPrice: 300, sellingPrice: 250 }]);
  assert.deepStrictEqual(ok.changes[0].set, { originalPrice: 300, sellingPrice: 250 });
});

test('size/colour products skip stock; sale products skip price', () => {
  const v = prod(A, { variants: [{ label: 'S', stock: 2 }] });
  const s = prod(B, { sale: { applied: true } });
  const plan = tools.planBulk([v, s], [
    { id: A, stock: 50, sellingPrice: 380 },
    { id: B, stock: 50, sellingPrice: 380 }
  ]);
  assert.deepStrictEqual(plan.changes.find(c => c.id === A).set, { sellingPrice: 380 });
  assert.deepStrictEqual(plan.changes.find(c => c.id === B).set, { stock: 50 });
  assert.strictEqual(plan.skipped.length, 2);
});

/* ---------- handlers ---------- */

function res() {
  const r = { code: 200, status(c) { r.code = c; return r; }, json(b) { r.body = b; return r; } };
  return r;
}

async function runBulk(body) {
  const r = res();
  let err = null;
  await tools.bulk({ body }, r, e => { err = e; });
  return { r, err };
}

test('bulk saves only after every row is valid (all or nothing)', async () => {
  calls.products = [prod(A), prod(B)];
  calls.bulk = null;
  const bad = await runBulk({ updates: [{ id: A, stock: 10 }, { id: B, sellingPrice: 999 }] });
  assert.ok(bad.err && bad.err.statusCode === 400 && /MRP se zyada/.test(bad.err.message));
  assert.strictEqual(calls.bulk, null);

  const good = await runBulk({ updates: [{ id: A, stock: 10 }, { id: B, sellingPrice: 300 }] });
  assert.strictEqual(good.r.body.updated, 2);
  assert.strictEqual(calls.bulk.length, 2);
  assert.deepStrictEqual(calls.bulk[0].updateOne.update, { $set: { stock: 10 } });
});

test('bulk refuses empty, oversized and non-id input', async () => {
  for (const body of [{}, { updates: [] }, { updates: [{ id: 'nope', stock: 1 }] },
    { updates: Array.from({ length: 101 }, () => ({ id: A, stock: 1 })) }]) {
    const out = await runBulk(body);
    assert.strictEqual(out.err && out.err.statusCode, 400, JSON.stringify(body).slice(0, 40));
  }
});

test('stock requests show counts only, never customer emails', async () => {
  calls.groups = [{ _id: A, waiting: 3, notified: 1, oldest: new Date('2026-11-01'), latest: new Date('2026-11-20') }];
  calls.products = [{ _id: A, name: 'Moon Lamp', stock: 0, isActive: true, images: [{ url: 'https://x/y.jpg' }] }];
  const r = res();
  await tools.stockRequests({}, r, () => {});
  assert.strictEqual(r.body.totalWaiting, 3);
  assert.strictEqual(r.body.rows[0].name, 'Moon Lamp');
  assert.ok(!JSON.stringify(r.body).includes('@'));
});

/* ---------- date filter ---------- */

test('date filter uses Indian days and includes the whole last day', () => {
  const r = istDayRange('2026-11-01', '2026-11-23');
  assert.strictEqual(r.$gte.toISOString(), '2026-10-31T18:30:00.000Z');
  assert.strictEqual(r.$lt.toISOString(), '2026-11-23T18:30:00.000Z');
  assert.deepStrictEqual(Object.keys(istDayRange('2026-11-01', '')), ['$gte']);
  assert.deepStrictEqual(Object.keys(istDayRange('', '2026-11-01')), ['$lt']);
});

test('date filter ignores junk and impossible dates', () => {
  assert.strictEqual(istDayRange('', ''), null);
  assert.strictEqual(istDayRange('abc', '2026/11/01'), null);
  assert.strictEqual(parseDay('2026-02-31'), null);
  assert.strictEqual(parseDay("2026-11-01' OR 1=1"), null);
  assert.strictEqual(istDayRange('2026-11-23', '2026-11-01'), null);
});

/* ---------- wiring ---------- */

test('routes exist and are owner-only for staff', () => {
  const routes = read('backend/routes/adminRoutes.js');
  assert.match(routes, /router\.post\('\/products\/bulk'/);
  assert.match(routes, /router\.get\('\/stock-requests'/);
  assert.ok(!ALLOWED.some(([, re]) => re.test('/products/bulk') || re.test('/stock-requests')));
});

test('bulk route is registered before /products/:id routes', () => {
  const routes = read('backend/routes/adminRoutes.js');
  assert.ok(routes.indexOf("'/products/bulk'") < routes.indexOf("'/products/:id'"));
});

test('orders list uses the date range; page has the date filter', () => {
  assert.match(read('backend/controllers/adminController.js'), /istDayRange\(req\.query\.from, req\.query\.to\)/);
  const html = read('admin/orders.html');
  for (const id of ['dateFrom', 'dateTo', 'dateFilter']) assert.ok(html.includes(`id="${id}"`), id);
  assert.match(read('admin/js/orders.js'), /dateQuery\(\)/);
});

test('bulk page is in the menu and talks to the right routes', () => {
  assert.match(read('admin/js/nav.js'), /quick-stock\.html/);
  const page = read('admin/quick-stock.html');
  assert.match(page, /\/admin\/products\/bulk/);
  assert.match(page, /\/admin\/stock-requests/);
  assert.match(page, /noindex/);
});
