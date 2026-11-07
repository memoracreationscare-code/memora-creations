/*
  MEMORA CREATIONS - ORDER INVOICE (BILL)

  Adds a "Download Invoice" button to the order details page. It
  opens a clean bill in a new window and starts printing, where the
  customer can choose "Save as PDF". The bill is built in the browser
  from the order the customer already sees, nothing new is stored.

  This is an order bill. It is not a GST tax invoice.
*/
(() => {

  const esc = value =>
    String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));

  const money = value =>
    '₹' + Number(value || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });

  function paymentText(order) {
    if (order.codAdvance?.enabled) {
      return 'Advance ' + money(order.codAdvance.advanceAmount) +
        ' paid online; ' + money(order.codAdvance.balanceAmount) +
        (order.codAdvance.balanceStatus === 'RECEIVED'
          ? ' paid on delivery'
          : ' to pay on delivery (cash)');
    }

    if (order.paymentMethod === 'COD') {
      return order.paymentStatus === 'SUCCESS'
        ? 'Cash on Delivery (paid)'
        : 'Cash on Delivery (pay at delivery)';
    }

    return order.paymentStatus === 'SUCCESS'
      ? 'Online payment (paid)'
      : 'Online payment (' + String(order.paymentStatus || 'pending').toLowerCase() + ')';
  }

  function billHtml(order) {
    const address = order.shippingAddress || {};
    const items = Array.isArray(order.items) ? order.items : [];
    const date = order.createdAt
      ? new Date(order.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' })
      : '';

    const rows = items.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${esc(item.name)}</td>
        <td class="num">${esc(item.quantity)}</td>
        <td class="num">${esc(money(item.unitPrice))}</td>
        <td class="num">${esc(money(item.lineTotal))}</td>
      </tr>`).join('');

    const extra = [];

    if (Number(order.deliveryCharge) > 0) {
      extra.push(['Delivery', money(order.deliveryCharge)]);
    }

    const discount = Number(order.couponDiscount || order.discount || 0);

    if (discount > 0) {
      extra.push(['Discount', '- ' + money(discount)]);
    }

    const giftFee = Number(order.giftWrapping?.fee || 0);

    if (order.giftWrapping?.selected && giftFee > 0) {
      extra.push(['Gift wrapping', money(giftFee)]);
    }

    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>Invoice ${esc(order.orderId)} | Memora Creations</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#2b2018;margin:0;padding:28px;font-size:14px}
  .wrap{max-width:760px;margin:0 auto}
  header{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #8a5a3b;padding-bottom:14px}
  h1{margin:0;font-size:22px;letter-spacing:1px}
  .muted{color:#6b5a4a;line-height:1.6}
  .tag{font-size:20px;font-weight:700;color:#8a5a3b;text-align:right}
  .cols{display:flex;gap:30px;margin:20px 0;flex-wrap:wrap}
  .cols div{flex:1;min-width:220px;line-height:1.6}
  table{width:100%;border-collapse:collapse;margin-top:6px}
  th,td{padding:9px 8px;border-bottom:1px solid #e6dccb;text-align:left}
  th{background:#f7f1e5;font-size:12px;text-transform:uppercase;letter-spacing:.5px}
  .num{text-align:right}
  .totals{margin-left:auto;margin-top:14px;width:290px}
  .totals div{display:flex;justify-content:space-between;padding:5px 0}
  .totals .grand{border-top:2px solid #8a5a3b;margin-top:6px;padding-top:9px;font-weight:700;font-size:16px}
  footer{margin-top:34px;text-align:center;color:#6b5a4a;font-size:12.5px;line-height:1.7}
  @media print{body{padding:0}}
</style></head><body><div class="wrap">
<header>
  <div>
    <h1>MEMORA CREATIONS</h1>
    <div class="muted">Kotwa Kalan, Post Kotwa Bazar,<br>Kushinagar, Uttar Pradesh &ndash; 274305<br>
    +91 88740 50204 &middot; memoracreations.care@gmail.com</div>
  </div>
  <div><div class="tag">INVOICE</div>
    <div class="muted" style="text-align:right">Order ${esc(order.orderId)}<br>${esc(date)}</div></div>
</header>
<div class="cols">
  <div><b>Billed / shipped to</b><br>${esc(address.fullName)}<br>${esc(address.addressLine)}<br>
    ${esc([address.city, address.state].filter(Boolean).join(', '))} ${esc(address.pinCode)}<br>
    Mobile: ${esc(address.mobile)}</div>
  <div><b>Payment</b><br>${esc(paymentText(order))}<br><br><b>Order status</b><br>${esc(order.orderStatus)}</div>
</div>
<table>
  <thead><tr><th>#</th><th>Product</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Amount</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="totals">
  <div><span>Subtotal</span><span>${esc(money(order.subtotal))}</span></div>
  ${extra.map(([label, value]) => `<div><span>${esc(label)}</span><span>${esc(value)}</span></div>`).join('')}
  <div class="grand"><span>Total</span><span>${esc(money(order.grandTotal))}</span></div>
</div>
<footer>Thank you for shopping with Memora Creations.<br>
This is a computer generated bill for your order and does not need a signature.</footer>
</div></body></html>`;
  }

  function openInvoice() {
    // currentOrderDetails is set by order-details.js
    const order =
      typeof currentOrderDetails !== 'undefined' ? currentOrderDetails : null;

    if (!order) return;

    const win = window.open('', '_blank');

    if (!win) {
      window.MC?.toast?.('Please allow pop-ups to open the invoice.', 'error');
      return;
    }

    win.document.open();
    win.document.write(billHtml(order));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }

  function addButton() {
    const hero = document.querySelector('.order-status-hero');

    if (!hero || hero.querySelector('.mc-invoice-btn')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mc-invoice-btn';
    button.textContent = '🧾 Download Invoice';
    button.style.cssText =
      'margin-top:12px;padding:10px 16px;border:1px solid #8a5a3b;border-radius:999px;' +
      'background:#fff;color:#8a5a3b;font:inherit;font-weight:700;font-size:13px;cursor:pointer';
    button.addEventListener('click', openInvoice);

    (hero.firstElementChild || hero).appendChild(button);
  }

  function start() {
    const box = document.querySelector('#order');

    if (!box) return;

    new MutationObserver(addButton).observe(box, { childList: true, subtree: true });
    addButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

})();
