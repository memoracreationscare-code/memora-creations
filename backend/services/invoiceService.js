'use strict';

/*
  Bill / GST tax invoice for an order.

  - Bill number is given ONCE, the first time the invoice is opened:
    MC/2026-27/00001 (running number, financial year April-March).
  - GST is shown only when the owner switched "GST invoice" ON in Store
    Settings and entered the GSTIN. Prices on the shop are treated as
    GST-INCLUSIVE (the usual way for online shops): the tax is taken OUT of
    the total, never added on top, so the customer pays the same amount.
  - Same state as the shop: CGST + SGST halves. Other state: IGST.
  - Otherwise it is a plain bill with no tax lines.

  This is a helper for bookkeeping. Please have your CA confirm the rate,
  HSN and your registration type.
*/

const round2 = n => Math.round((Number(n) || 0) * 100) / 100;

function fiscalYear(date) {
  const d = new Date(date);
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;

  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

const sameState = (a, b) =>
  String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase() && !!String(a || '').trim();

function taxBreakup(total, rate, sellerState, buyerState) {
  const t = round2(total);
  const r = Number(rate) || 0;

  if (r <= 0) return { taxable: t, rate: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0 };

  const taxable = round2(t / (1 + r / 100));
  const totalTax = round2(t - taxable);

  if (sameState(sellerState, buyerState)) {
    const cgst = round2(totalTax / 2);

    return { taxable, rate: r, cgst, sgst: round2(totalTax - cgst), igst: 0, totalTax };
  }

  return { taxable, rate: r, cgst: 0, sgst: 0, igst: totalTax, totalTax };
}

const eligible = order =>
  order.orderStatus !== 'Cancelled' &&
  (order.paymentMethod === 'COD' || order.paymentStatus === 'SUCCESS');

function build(order, settings, invoiceNo, invoiceDate) {
  const address = order.shippingAddress || {};
  const gstOn = settings.gstEnabled === true && !!settings.gstin;
  const total = round2(order.grandTotal);

  return {
    success: true,
    invoiceNo,
    invoiceDate,
    gstInvoice: gstOn,
    title: gstOn ? 'TAX INVOICE' : 'INVOICE',
    seller: {
      name: settings.gstLegalName || 'Memora Creations',
      address: settings.address || '',
      phone: settings.phone || '',
      email: settings.email || '',
      gstin: gstOn ? settings.gstin : '',
      state: settings.gstState || ''
    },
    buyer: {
      name: address.fullName || order.customer?.fullName || '',
      address: address.addressLine || '',
      city: address.city || '',
      state: address.state || '',
      pinCode: address.pinCode || '',
      mobile: address.mobile || ''
    },
    order: {
      orderId: order.orderId,
      createdAt: order.createdAt,
      orderStatus: order.orderStatus,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      codAdvance: order.codAdvance && order.codAdvance.enabled ? {
        advanceAmount: order.codAdvance.advanceAmount,
        balanceAmount: order.codAdvance.balanceAmount,
        balanceStatus: order.codAdvance.balanceStatus
      } : null
    },
    items: (order.items || []).map(i => ({
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal
    })),
    subtotal: round2(order.subtotal),
    deliveryCharge: round2(order.deliveryCharge),
    discount: round2(order.couponDiscount || order.discount || 0),
    giftFee: order.giftWrapping && order.giftWrapping.selected ? round2(order.giftWrapping.fee) : 0,
    grandTotal: total,
    tax: gstOn ? { ...taxBreakup(total, settings.gstRate, settings.gstState, address.state), intraState: sameState(settings.gstState, address.state) } : null
  };
}

/* Gives the order its bill number the first time (never changes afterwards). */
async function ensureInvoiceNumber(order, models) {
  if (order.invoiceNo || !eligible(order)) return order;

  const { Order, SiteSettings } = models;
  const date = new Date();

  const doc = await SiteSettings.findOneAndUpdate(
    { key: 'main' },
    { $inc: { invoiceCounter: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  const invoiceNo = `MC/${fiscalYear(date)}/${String(doc.invoiceCounter).padStart(5, '0')}`;

  const res = await Order.updateOne(
    { _id: order._id, $or: [{ invoiceNo: null }, { invoiceNo: { $exists: false } }] },
    { $set: { invoiceNo, invoiceDate: date } },
    { timestamps: false }
  );

  if (!(res.modifiedCount > 0 || res.nModified > 0)) {
    return Order.findById(order._id).lean();   // someone else numbered it first
  }

  return { ...order, invoiceNo, invoiceDate: date };
}

async function invoiceFor(order, models, settings) {
  const numbered = await ensureInvoiceNumber(order, models);

  return build(numbered, settings, numbered.invoiceNo || '', numbered.invoiceDate || numbered.createdAt);
}

module.exports = { invoiceFor, build, taxBreakup, fiscalYear, ensureInvoiceNumber, eligible };
