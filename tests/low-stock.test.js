'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { sweepLowStock, buildEmail } = require('../backend/services/lowStockAlert');

function deps({ enabled = true, configured = true, email = 'owner@x.com', products = [], fail = false } = {}) {
  const calls = { updates: [], mails: [] };

  return {
    calls,
    Product: {
      updateMany: async (q, u) => { calls.updates.push(u); },
      find: () => ({ select: () => ({ limit: () => ({ lean: async () => products }) }) })
    },
    settings: { peek: () => ({ lowStockEmailEnabled: enabled, email }) },
    mail: {
      mailConfigured: () => configured,
      sendMail: async m => { if (fail) throw new Error('mail down'); calls.mails.push(m); }
    }
  };
}

test('does nothing when switched off or mail is not set up', async () => {
  assert.deepStrictEqual(await sweepLowStock(deps({ enabled: false, products: [{ _id: 1, name: 'A', stock: 1 }] })), { sent: 0 });
  assert.deepStrictEqual(await sweepLowStock(deps({ configured: false })), { sent: 0 });
});

test('one email lists every low product, options by name', async () => {
  const d = deps({ products: [
    { _id: 1, name: 'Moon Lamp', stock: 2 },
    { _id: 2, name: 'Frame', stock: 5, variants: [{ label: 'Large', stock: 1 }, { label: 'Small', stock: 4 }] }
  ] });
  const r = await sweepLowStock(d);
  assert.strictEqual(r.sent, 2);
  assert.strictEqual(d.calls.mails.length, 1);
  assert.strictEqual(d.calls.mails[0].to, 'owner@x.com');
  assert.match(d.calls.mails[0].html, /Moon Lamp: 2 bacha/);
  assert.match(d.calls.mails[0].html, /Frame \(Large\): 1 bacha/);
  assert.ok(!/Small/.test(d.calls.mails[0].html));
});

test('if the email fails the products are released to be tried again', async () => {
  const d = deps({ fail: true, products: [{ _id: 1, name: 'A', stock: 1 }] });
  const r = await sweepLowStock(d);
  assert.strictEqual(r.sent, 0);
  assert.ok(d.calls.updates.some(u => u.$unset && 'lowStockAlertedAt' in u.$unset));
});

test('email text escapes product names', () => {
  assert.ok(!buildEmail([{ _id: 1, name: '<b>x</b>', stock: 1 }]).html.includes('<b>x</b>'));
});
