'use strict';

/* Customer emails: order updates and cart reminders. Plain, mobile friendly. */

const SITE = 'https://memoracreationscare-code.github.io/memora-creations/frontend';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const rupees = n => '₹' + (Math.round(Number(n || 0) * 100) / 100).toLocaleString('en-IN');

function shell(title, bodyHtml, button) {
  return `<!doctype html><html><body style="margin:0;background:#f7f1e5;font-family:Arial,sans-serif;color:#3b2a1d">
  <div style="max-width:560px;margin:0 auto;padding:18px">
    <div style="background:#fff;border-radius:16px;padding:24px">
      <div style="font-size:13px;letter-spacing:3px;color:#8a5a3b;font-weight:700">MEMORA CREATIONS</div>
      <h2 style="margin:12px 0 10px;font-size:21px">${esc(title)}</h2>
      ${bodyHtml}
      ${button ? `<p style="margin:22px 0 4px"><a href="${esc(button.url)}" style="background:#8a5a3b;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700;display:inline-block">${esc(button.text)}</a></p>` : ''}
    </div>
    <p style="text-align:center;font-size:12px;color:#8a7a68">Memora Creations, Kotwa Kalan, Kushinagar, Uttar Pradesh 274305</p>
  </div></body></html>`;
}

function itemsTable(items) {
  const rows = (items || []).map(i =>
    `<tr><td style="padding:6px 0">${esc(i.name)} × ${esc(i.quantity)}</td>` +
    `<td style="padding:6px 0;text-align:right">${rupees(i.lineTotal != null ? i.lineTotal : (i.unitPrice ?? i.price ?? 0) * (i.quantity || 1))}</td></tr>`
  ).join('');

  return `<table style="width:100%;border-collapse:collapse;font-size:14px;border-top:1px solid #eee;margin-top:8px">${rows}</table>`;
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
    `<p style="margin:0;font-size:14px"><b>Order:</b> ${esc(order.orderId)} &nbsp; <b>Total:</b> ${rupees(order.grandTotal)}</p>` +
    itemsTable(order.items);

  return {
    subject: m.subject,
    html: shell(m.title, body, {
      text: 'View / Track Order',
      url: `${SITE}/order-details.html?id=${encodeURIComponent(order._id)}`
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

module.exports = { orderEmail, cartReminderEmail, ORDER_EVENTS };
