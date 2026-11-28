'use strict';

/* Customer emails: order updates and cart reminders. Plain, mobile friendly. */

const SITE = 'https://memoracreationscare.in/frontend';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const rupees = n => '₹' + (Math.round(Number(n || 0) * 100) / 100).toLocaleString('en-IN');

/* Support details shown in every email: from Admin -> Settings, else the shop's own. */
function support() {
  let s = {};

  try { s = require('../services/settingsService').peek(); } catch (_) { /* defaults below */ }

  const wa = String(s.whatsapp || '918874050204').replace(/\D/g, '');
  const email = String(s.email || 'memoracreations.care@gmail.com');
  const shown = wa.length === 12 && wa.startsWith('91') ? `+91 ${wa.slice(2, 7)} ${wa.slice(7)}` : '+' + wa;

  return { wa, email, shown };
}

/* One look for every email: brand header, card, button, help box, footer.
   Email-safe (tables + inline styles), readable on phones and in dark mode. */
function shell(title, bodyHtml, button, opts = {}) {
  const sp = support();
  const pre = opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(opts.preheader)}</div>` : '';

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f3ebe2;font-family:Arial,Helvetica,sans-serif;color:#3b2a1d">${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3ebe2"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px">
    <tr><td align="center" style="background:#3d2517;border-radius:16px 16px 0 0;padding:26px 20px 22px">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;letter-spacing:6px;color:#f1d3a8;font-weight:bold">MEMORA</div>
      <div style="font-size:11px;letter-spacing:5px;color:#c9a27a;margin-top:4px">CREATIONS</div>
    </td></tr>
    <tr><td style="background:#ffffff;padding:30px 28px 26px;border-left:1px solid #eadfd3;border-right:1px solid #eadfd3">
      <h1 style="margin:0 0 6px;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.3;color:#2b1b12;font-weight:normal">${esc(title)}</h1>
      <div style="width:46px;height:3px;background:#b9855a;margin:10px 0 20px;border-radius:2px"></div>
      <div style="font-size:15px;line-height:1.7;color:#3b2a1d">${bodyHtml}</div>
      ${button ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 6px"><tr><td align="center" bgcolor="#8a5a3b" style="border-radius:10px"><a href="${esc(button.url)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:10px">${esc(button.text)}</a></td></tr></table>` : ''}
    </td></tr>
    <tr><td style="background:#faf5ef;padding:18px 28px;border:1px solid #eadfd3;border-top:0;border-radius:0 0 16px 16px">
      <div style="font-size:13px;color:#6d5a49;line-height:1.7"><b style="color:#3b2a1d">Madad chahiye?</b><br>
      WhatsApp: <a href="https://wa.me/${esc(sp.wa)}" style="color:#8a5a3b;text-decoration:none">${esc(sp.shown)}</a> &nbsp;|&nbsp; Email: <a href="mailto:${esc(sp.email)}" style="color:#8a5a3b;text-decoration:none">${esc(sp.email)}</a></div>
    </td></tr>
    <tr><td align="center" style="padding:18px 10px 4px;font-size:12px;color:#8a7a68;line-height:1.6">
      Memora Creations &middot; Kotwa Kalan, Kushinagar, Uttar Pradesh 274305<br>
      <a href="https://memoracreationscare.in" style="color:#8a7a68">memoracreationscare.in</a>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

function itemsTable(items) {
  const rows = (items || []).map(i =>
    `<tr><td style="padding:9px 0;border-bottom:1px solid #f0e8de">${esc(i.name)} × ${esc(i.quantity)}</td>` +
    `<td style="padding:9px 0;border-bottom:1px solid #f0e8de;text-align:right">${rupees(i.lineTotal != null ? i.lineTotal : (i.unitPrice ?? i.price ?? 0) * (i.quantity || 1))}</td></tr>`
  ).join('');

  return `<table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:10px"><tr><td style="padding:8px 0;border-bottom:2px solid #eadfd3;font-size:12px;letter-spacing:1px;color:#8a7a68">ITEM</td><td style="padding:8px 0;border-bottom:2px solid #eadfd3;font-size:12px;letter-spacing:1px;color:#8a7a68;text-align:right">AMOUNT</td></tr>${rows}</table>`;
}

const ORDER_EVENTS = {
  ORDER_PLACED: o => ({
    subject: `Order ${o.orderId} received - thank you!`,
    title: 'Thank you! Your order is placed',
    text: 'We have received your order and will pack it with care.'
  }),
  SHIPPED: o => ({
    subject: `Your order ${o.orderId} is on its way`,
    title: 'Your order has been shipped',
    text: 'Your parcel has been handed to the courier.'
  }),
  OUT_FOR_DELIVERY: o => ({
    subject: `Your order ${o.orderId} is out for delivery`,
    title: 'Out for delivery today',
    text: 'The courier is bringing your parcel today. Please keep your phone nearby.'
  }),
  DELIVERED: o => ({
    subject: `Your order ${o.orderId} was delivered`,
    title: 'Delivered - we hope you love it!',
    text: 'Your order has been delivered. If anything is wrong, you can ask for a return or replacement from My Orders.'
  }),
  REVIEW_REQUEST: o => ({
    subject: `How did you like your order ${o.orderId}? ⭐`,
    title: 'Aapko hamara product kaisa laga?',
    text: 'Aapka ek chhota sa review dusre customers ki bahut madad karta hai. Photo ke saath review de sakte hain, sirf 1 minute lagega.'
  }),
  CANCELLED: o => ({
    subject: `Your order ${o.orderId} was cancelled`,
    title: 'Order cancelled',
    text: 'Your order has been cancelled. If you had paid online, the refund is on its way (5-7 working days).'
  }),
  REFUNDED: o => ({
    subject: `Refund for order ${o.orderId}`,
    title: 'Your refund is done',
    text: `Your refund${o.refund && o.refund.amount ? ' of ' + rupees(o.refund.amount) : ''} has been sent. It reaches your bank or UPI account in 5-7 working days.`
  })
};

function orderEmail(event, order) {
  const make = ORDER_EVENTS[event];

  if (!make) return null;

  const m = make(order);
  const name = order.shippingAddress && order.shippingAddress.fullName
    ? String(order.shippingAddress.fullName).split(' ')[0]
    : 'there';

  const body =
    `<p style="margin:0 0 10px">Hi ${esc(name)},</p>` +
    `<p style="margin:0 0 10px">${esc(m.text)}</p>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf5ef;border-radius:10px;margin:14px 0 6px"><tr><td style="padding:12px 16px;font-size:14px"><span style="color:#8a7a68">Order</span><br><b>${esc(order.orderId)}</b></td><td align="right" style="padding:12px 16px;font-size:14px"><span style="color:#8a7a68">Total</span><br><b>${rupees(order.grandTotal)}</b></td></tr></table>` +
    itemsTable(order.items);

  return {
    subject: m.subject,
    html: shell(m.title, body, {
      text: event === 'REVIEW_REQUEST' ? 'Review likhein ⭐' : 'View / Track Order',
      url: event === 'REVIEW_REQUEST'
        ? `${SITE}/orders.html`
        : `${SITE}/order-details.html?id=${encodeURIComponent(order._id)}`
    })
  };
}

function cartReminderEmail(cart) {
  const name = String(cart.fullName || '').split(' ')[0] || 'there';
  const body =
    `<p style="margin:0 0 10px">Hi ${esc(name)},</p>` +
    '<p style="margin:0 0 10px">You left something lovely in your cart. It is waiting for you:</p>' +
    itemsTable(cart.items) +
    `<p style="margin:10px 0 0;font-size:14px"><b>Total: ${rupees(cart.total)}</b></p>`;

  return {
    subject: 'You left something in your cart 🛒',
    html: shell('Still thinking it over?', body, {
      text: 'Complete my order',
      url: `${SITE}/cart.html`
    })
  };
}

function birthdayEmail(user) {
  const name = String((user && user.fullName) || '').split(' ')[0] || 'Dost';
  const body =
    `<p style="margin:0 0 10px">Dear ${esc(name)},</p>` +
    '<p style="margin:0 0 10px;font-size:16px"><b>Happy Birthday! 🎂🎉</b></p>' +
    '<p style="margin:0 0 10px">Memora Creations ki taraf se aapko janamdin ki dher saari shubhkamnayein. Aapka saal khushiyon, sehat aur sundar palon se bhara rahe.</p>' +
    '<p style="margin:0">Aaj ke din apne liye ya kisi khaas ke liye koi sundar decor ya gift chun lijiye. 💝</p>';

  return {
    subject: `Happy Birthday ${name}! 🎂 - Memora Creations`,
    html: shell('Happy Birthday! 🎉', body, {
      text: 'Gifts dekhein',
      url: `${SITE}/products.html`
    })
  };
}

function backInStockEmail(product) {
  const body =
    '<p style="margin:0 0 10px">Aapne jis product ke liye alert maanga tha, wo ab wapas stock me hai:</p>' +
    `<p style="margin:0 0 6px;font-size:16px"><b>${esc(product.name)}</b></p>` +
    `<p style="margin:0;font-size:14px">${rupees(product.sellingPrice)}</p>` +
    '<p style="margin:12px 0 0;font-size:13px;color:#8a7a68">Stock limited hota hai, jaldi order karein.</p>';

  return {
    subject: `Back in stock: ${product.name}`,
    html: shell('Wapas aa gaya! 🎉', body, {
      text: 'Abhi kharidein',
      url: `${SITE}/product.html?id=${encodeURIComponent(product._id)}`
    })
  };
}

function priceDropEmail(user, drops) {
  const name = String((user && user.fullName) || '').split(' ')[0] || 'Dost';
  const rows = drops.map(d =>
    `<p style="margin:0 0 10px;font-size:15px"><b>${esc(d.name)}</b><br>` +
    `<span style="text-decoration:line-through;color:#8a7a68">${rupees(d.oldPrice)}</span> ` +
    `<b style="color:#1f7a3d">${rupees(d.newPrice)}</b></p>`).join('');
  const body =
    `<p style="margin:0 0 10px">Dear ${esc(name)},</p>` +
    '<p style="margin:0 0 10px">Aapki Wishlist ke product ka daam kam ho gaya hai:</p>' +
    rows +
    '<p style="margin:12px 0 0;font-size:13px;color:#8a7a68">Offer limited samay ke liye ho sakta hai.</p>';

  return {
    subject: drops.length === 1 ? `Price drop: ${drops[0].name}` : 'Aapki Wishlist ke products sasta ho gaye',
    html: shell('Daam kam ho gaya! 🔔', body, { text: 'Wishlist dekhein', url: `${SITE}/wishlist.html` })
  };
}

module.exports = { shell, esc, orderEmail, cartReminderEmail, backInStockEmail, birthdayEmail, priceDropEmail, ORDER_EVENTS };
