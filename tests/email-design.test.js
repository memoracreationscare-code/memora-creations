const test = require('node:test');
const assert = require('node:assert');
const { shell, orderEmail } = require('../backend/utils/emailTemplates');

test('shell: branded header, button, help footer, escaped title', () => {
  const html = shell('<b>Hi</b>', '<p>x</p>', { text: 'Go', url: 'https://a.b/?x=1&y=2' }, { preheader: 'pre' });
  assert.match(html, /MEMORA/);
  assert.match(html, /Madad chahiye/);
  assert.match(html, /href="https:\/\/a\.b\/\?x=1&amp;y=2"/);
  assert.ok(!html.includes('<b>Hi</b>'));
});

test('shell without button has no button cell', () => {
  assert.ok(!shell('T', '<p>x</p>', null).includes('border-radius:10px"><a '));
});

test('orderEmail still renders with the new layout', () => {
  const e = orderEmail('ORDER_PLACED', { orderId: 'MC1', grandTotal: 500, items: [{ name: 'Lamp <x>', quantity: 1, price: 500 }], customerName: 'A' });
  assert.ok(e && e.html.includes('MC1'));
  assert.ok(!e.html.includes('Lamp <x>'));
});
