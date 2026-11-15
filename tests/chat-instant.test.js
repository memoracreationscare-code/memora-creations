'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const inst = require('../backend/services/chatInstant');

const settings = {
  deliveryCharge: 60, freeDeliveryAbove: 999, codEnabled: true, codAdvanceEnabled: true, codAdvancePercent: 20,
  returnsEnabled: true, returnWindowDays: 7, giftWrapEnabled: true, giftWrapStandardFee: 30, giftWrapPremiumFee: 60,
  whatsapp: '918874050204', address: 'Kushinagar', welcomeEnabled: true, welcomePercent: 10, welcomeMaxDiscount: 100, welcomeMinOrder: 499
};
const future = new Date(Date.now() + 5 * 864e5);
const past = new Date(Date.now() - 864e5);

const chain = rows => { const c = { select: () => c, sort: () => c, limit: () => c, populate: () => c, lean: async () => rows }; return c; };
let productQueries = [];
const frame = { _id: 'p1', name: 'Wedding Photo Frame', sellingPrice: 599, originalPrice: 799, stock: 3, variants: [] };
const models = {
  Product: { find: q => { productQueries.push(q); return chain(q['sale.applied'] ? [] : [frame]); } },
  Category: { find: () => chain([{ name: 'Photo Frame' }, { name: 'Home Decor' }]) },
  Coupon: { find: () => chain([{ code: 'WELCOME10', discountType: 'PERCENTAGE', discountValue: 10, minOrderAmount: 499, usageLimit: 100, usedCount: 1, startsAt: past, expiresAt: future, firstOrderOnly: true }]) },
  Order: { find: () => chain([]) },
  ShipmentTracking: { findOne: () => chain(null) }
};
const base = { models, siteUrl: 'https://s.in', lookupOrder: async () => null };
const ask = (text, extra = {}, history = []) => inst.tryAnswer([...history, { role: 'user', content: text }], settings, { ...base, ...extra });

test('intent detection: shop questions yes, odd questions fall through to the AI', () => {
  assert.equal(inst.detect('Abhi kaun sa offer chal raha hai?'), 'offers');
  assert.equal(inst.detect('kaun kaun se gift diye ja sakte hai'), 'products');
  assert.equal(inst.detect('mera order kahan hai'), 'order');
  assert.equal(inst.detect('MC-2026-ABC123'), 'order');
  assert.equal(inst.detect('delivery charge kitna hai'), 'delivery');
  assert.equal(inst.detect('hi'), 'greet');
  assert.equal(inst.detect('kaise banta hai ye resin art ka process'), null);
});

test('offers come from the database: coupon details are listed', async () => {
  const out = await ask('Abhi kaun sa offer chal raha hai?');
  assert.match(out, /WELCOME10/);
  assert.match(out, /10% off/);
  assert.match(out, /minimum order Rs 499/);
  assert.match(out, /Free|free|delivery free/i);
});

test('gifts: lists categories and real products with links, no AI', async () => {
  const out = await ask('kaun kaun se gift diye ja sakte hai');
  assert.match(out, /Photo Frame, Home Decor/);
  assert.match(out, /Wedding Photo Frame - Rs 599/);
  assert.match(out, /https:\/\/s\.in\/frontend\/product\.html\?id=p1/);
});

test('logged-in customer: order answered from their own orders only', async () => {
  let filter;
  const m = { ...models, Order: { find: f => { filter = f; return chain([{
    _id: 'o1', orderId: 'MC-2026-AAA111', orderStatus: 'Shipped', grandTotal: 699, paymentMethod: 'COD',
    codAdvance: { enabled: true, advanceAmount: 100, balanceAmount: 599, balanceStatus: 'PENDING' },
    items: [{ product: 'p1', name: 'Wedding Photo Frame', quantity: 1 }], statusHistory: []
  }]); } },
  ShipmentTracking: { findOne: () => chain({ awbCode: 'AWB9', courierName: 'Delhivery', trackingUrl: 'https://t.example/9' }) } };
  const out = await ask('mera order kahan hai', { userId: 'U1', models: m });
  assert.equal(filter.user, 'U1');
  assert.match(out, /MC-2026-AAA111: Shipped/);
  assert.match(out, /Wedding Photo Frame x1/);
  assert.match(out, /advance Rs 100 .* Rs 599 dena hai/);
  assert.match(out, /Delhivery/);
  assert.match(out, /https:\/\/t\.example\/9/);
});

test('logged-out: needs order number AND mobile, then uses the same lookup as Track Order', async () => {
  const askBoth = await ask('mera order kahan hai');
  assert.match(askBoth, /order number .* mobile number/);
  assert.match(await ask('MC-2026-AAA111'), /mobile number bhi bhejiye/);

  const calls = [];
  const lookupOrder = async (id, mob) => { calls.push([id, mob]); return { orderId: id, orderStatus: 'Packed', items: [{ name: 'Vase', quantity: 2 }], shipment: null }; };
  const history = [{ role: 'user', content: 'MC-2026-AAA111' }, { role: 'assistant', content: 'Order dekhne ke liye mobile number bhi bhejiye.' }];
  const out = await ask('9876543210', { lookupOrder }, history);
  assert.deepEqual(calls, [['MC-2026-AAA111', '9876543210']]);
  assert.match(out, /Packed/);
  assert.match(out, /Vase x2/);

  const wrong = await ask('MC-2026-AAA111 9876543210', { lookupOrder: async () => null });
  assert.match(wrong, /match nahi hui/);
});

test('policies come from settings', async () => {
  assert.match(await ask('delivery charge kitna hai'), /Rs 60.*Rs 999/s);
  assert.match(await ask('return kaise hota hai'), /7 din/);
  assert.match(await ask('cod available hai?'), /20% advance/);
  assert.match(await ask('whatsapp number do'), /wa\.me\/918874050204/);
});

test('unknown question returns null (AI handles it); fallback menu is friendly', async () => {
  assert.equal(await ask('resin art ka process kya hota hai'), null);
  assert.match(inst.fallbackMenu(settings), /Kaun kaun se gift/);
});
