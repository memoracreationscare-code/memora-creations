'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { taxBreakup, fiscalYear, build, invoiceFor, eligible } = require('../backend/services/invoiceService');

test('financial year runs April to March', () => {
  assert.strictEqual(fiscalYear('2026-11-12'), '2026-27');
  assert.strictEqual(fiscalYear('2027-02-10'), '2026-27');
  assert.strictEqual(fiscalYear('2027-04-01'), '2027-28');
});

test('GST is taken out of the GST-inclusive total (customer pays the same)', () => {
  const same = taxBreakup(1180, 18, 'Uttar Pradesh', 'uttar pradesh');
  assert.deepStrictEqual(same, { taxable: 1000, rate: 18, cgst: 90, sgst: 90, igst: 0, totalTax: 180 });
  const other = taxBreakup(1180, 18, 'Uttar Pradesh', 'Delhi');
  assert.deepStrictEqual(other, { taxable: 1000, rate: 18, cgst: 0, sgst: 0, igst: 180, totalTax: 180 });
});

test('cgst + sgst + taxable always add back to the total (odd paise)', () => {
  const t = taxBreakup(499, 12, 'UP', 'UP');
  assert.strictEqual(Math.round((t.taxable + t.cgst + t.sgst) * 100) / 100, 499);
});

const order = {
  _id: 'o1', orderId: 'MC_1', orderStatus: 'Confirmed', paymentMethod: 'COD', paymentStatus: 'COD_PENDING',
  createdAt: new Date('2026-11-12'), subtotal: 1100, deliveryCharge: 80, grandTotal: 1180,
  shippingAddress: { fullName: 'Asha', addressLine: 'x', city: 'Lucknow', state: 'Uttar Pradesh', pinCode: '226001', mobile: '9876543210' },
  items: [{ name: 'Lamp', quantity: 2, unitPrice: 550, lineTotal: 1100 }]
};

test('plain bill when GST is off; tax invoice with seller GSTIN when on', () => {
  const off = build(order, { gstEnabled: false }, 'MC/2026-27/00001', order.createdAt);
  assert.strictEqual(off.title, 'INVOICE');
  assert.strictEqual(off.tax, null);
  assert.strictEqual(off.seller.gstin, '');

  const on = build(order, { gstEnabled: true, gstin: '09ABCDE1234F1Z5', gstRate: 18, gstState: 'Uttar Pradesh' }, 'N', order.createdAt);
  assert.strictEqual(on.title, 'TAX INVOICE');
  assert.strictEqual(on.tax.intraState, true);
  assert.strictEqual(on.tax.cgst, 90);
  assert.strictEqual(on.seller.gstin, '09ABCDE1234F1Z5');

  // switched on but no GSTIN typed yet -> still a plain bill
  assert.strictEqual(build(order, { gstEnabled: true, gstin: '' }, 'N', order.createdAt).gstInvoice, false);
});

test('cancelled or unpaid online orders get no bill number', () => {
  assert.strictEqual(eligible({ ...order, orderStatus: 'Cancelled' }), false);
  assert.strictEqual(eligible({ ...order, paymentMethod: 'ONLINE', paymentStatus: 'PENDING' }), false);
  assert.strictEqual(eligible({ ...order, paymentMethod: 'ONLINE', paymentStatus: 'SUCCESS' }), true);
});

test('bill number is assigned once, from a running counter', async () => {
  let counter = 6;
  const updates = [];
  const models = {
    SiteSettings: { findOneAndUpdate: () => ({ lean: async () => ({ invoiceCounter: ++counter }) }) },
    Order: { updateOne: async (f, u) => { updates.push(u.$set.invoiceNo); return { modifiedCount: 1 }; } }
  };
  const a = await invoiceFor({ ...order }, models, { gstEnabled: false });
  assert.match(a.invoiceNo, /^MC\/\d{4}-\d{2}\/00007$/);

  // already numbered: counter untouched, number unchanged
  const b = await invoiceFor({ ...order, invoiceNo: 'MC/2026-27/00003', invoiceDate: order.createdAt }, models, { gstEnabled: false });
  assert.strictEqual(b.invoiceNo, 'MC/2026-27/00003');
  assert.strictEqual(counter, 7);
  assert.strictEqual(updates.length, 1);
});
