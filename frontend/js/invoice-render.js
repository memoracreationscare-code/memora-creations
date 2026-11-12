/*
  MEMORA CREATIONS - INVOICE VIEW (shared by customer + admin)

  Turns the invoice the server builds (GET .../orders/:id/invoice) into a
  clean printable page and opens it in a new window, where "Save as PDF"
  is available. All numbers (bill no., GST split) come from the server.
*/
(() => {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = v => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const day = d => (d ? new Date(d).toLocaleDateString('en-IN', { dateStyle: 'long' }) : '');

  function paymentText(o) {
    if (o.codAdvance) {
      return `Advance ${money(o.codAdvance.advanceAmount)} paid online; ${money(o.codAdvance.balanceAmount)}` +
        (o.codAdvance.balanceStatus === 'RECEIVED' ? ' paid on delivery' : ' to pay on delivery (cash)');
    }
    if (o.paymentMethod === 'COD') return o.paymentStatus === 'SUCCESS' ? 'Cash on Delivery (paid)' : 'Cash on Delivery (pay at delivery)';
    return o.paymentStatus === 'SUCCESS' ? 'Online payment (paid)' : 'Online payment (' + String(o.paymentStatus || 'pending').toLowerCase() + ')';
  }

  function html(inv) {
    const s = inv.seller || {}, b = inv.buyer || {}, o = inv.order || {}, t = inv.tax;
    const rows = (inv.items || []).map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.name)}</td><td class="num">${esc(i.quantity)}</td><td class="num">${esc(money(i.unitPrice))}</td><td class="num">${esc(money(i.lineTotal))}</td></tr>`).join('');

    const lines = [['Subtotal', money(inv.subtotal)]];
    if (inv.deliveryCharge > 0) lines.push(['Delivery', money(inv.deliveryCharge)]);
    if (inv.giftFee > 0) lines.push(['Gift wrapping', money(inv.giftFee)]);
    if (inv.discount > 0) lines.push(['Discount', '- ' + money(inv.discount)]);

    const taxBox = t ? `<div class="tax"><b>Tax details (GST ${esc(t.rate)}% included in price)</b>
      <div><span>Taxable value</span><span>${esc(money(t.taxable))}</span></div>
      ${t.intraState
        ? `<div><span>CGST ${esc(t.rate / 2)}%</span><span>${esc(money(t.cgst))}</span></div><div><span>SGST ${esc(t.rate / 2)}%</span><span>${esc(money(t.sgst))}</span></div>`
        : `<div><span>IGST ${esc(t.rate)}%</span><span>${esc(money(t.igst))}</span></div>`}
      <div><span>Total GST</span><span>${esc(money(t.totalTax))}</span></div></div>` : '';

    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>${esc(inv.title)} ${esc(inv.invoiceNo || o.orderId)} | ${esc(s.name)}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;color:#2b2018;margin:0;padding:28px;font-size:14px}
.wrap{max-width:760px;margin:0 auto}
header{display:flex;justify-content:space-between;gap:20px;border-bottom:2px solid #8a5a3b;padding-bottom:14px}
h1{margin:0;font-size:22px;letter-spacing:1px}.muted{color:#6b5a4a;line-height:1.6}
.tag{font-size:20px;font-weight:700;color:#8a5a3b;text-align:right}
.cols{display:flex;gap:30px;margin:20px 0;flex-wrap:wrap}.cols div{flex:1;min-width:220px;line-height:1.6}
table{width:100%;border-collapse:collapse;margin-top:6px}th,td{padding:9px 8px;border-bottom:1px solid #e6dccb;text-align:left}
th{background:#f7f1e5;font-size:12px;text-transform:uppercase;letter-spacing:.5px}.num{text-align:right}
.totals,.tax{margin-left:auto;margin-top:14px;width:300px}
.totals div,.tax div{display:flex;justify-content:space-between;padding:4px 0}
.totals .grand{border-top:2px solid #8a5a3b;margin-top:6px;padding-top:9px;font-weight:700;font-size:16px}
.tax{font-size:13px;color:#4a3a2a;background:#faf6ee;border-radius:8px;padding:10px 12px;box-sizing:border-box}
footer{margin-top:34px;text-align:center;color:#6b5a4a;font-size:12.5px;line-height:1.7}
@media print{body{padding:0}}
</style></head><body><div class="wrap">
<header><div><h1>${esc(String(s.name || 'Memora Creations').toUpperCase())}</h1>
<div class="muted">${esc(s.address)}<br>${esc(s.phone)} &middot; ${esc(s.email)}${s.gstin ? `<br><b>GSTIN: ${esc(s.gstin)}</b>` : ''}</div></div>
<div><div class="tag">${esc(inv.title)}</div>
<div class="muted" style="text-align:right">${inv.invoiceNo ? 'No: <b>' + esc(inv.invoiceNo) + '</b><br>' : ''}Date: ${esc(day(inv.invoiceDate))}<br>Order: ${esc(o.orderId)}</div></div></header>
<div class="cols"><div><b>Billed / shipped to</b><br>${esc(b.name)}<br>${esc(b.address)}<br>${esc([b.city, b.state].filter(Boolean).join(', '))} ${esc(b.pinCode)}<br>Mobile: ${esc(b.mobile)}</div>
<div><b>Payment</b><br>${esc(paymentText(o))}${t ? `<br><br><b>Place of supply</b><br>${esc(b.state)}` : ''}</div></div>
<table><thead><tr><th>#</th><th>Product</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div class="totals">${lines.map(([l, v]) => `<div><span>${esc(l)}</span><span>${esc(v)}</span></div>`).join('')}
<div class="grand"><span>Total</span><span>${esc(money(inv.grandTotal))}</span></div></div>
${taxBox}
<footer>Thank you for shopping with ${esc(s.name || 'Memora Creations')}.<br>This is a computer generated ${t ? 'tax invoice' : 'bill'} and does not need a signature.</footer>
</div></body></html>`;
  }

  /* Opens a ready invoice in a new window and starts printing (Save as PDF). */
  async function open(orderId, base) {
    const win = window.open('', '_blank');

    if (!win) {
      window.MC?.toast?.('Pop-up allow karein, tab invoice khulega.', 'error');
      return;
    }
    win.document.write('<p style="font-family:Arial;padding:24px">Invoice ban raha hai…</p>');

    try {
      const data = await window.MC.api((base || '/orders/') + encodeURIComponent(orderId) + '/invoice');
      win.document.open();
      win.document.write(html(data.invoice));
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 400);
    } catch (err) {
      win.close();
      window.MC?.toast?.(err?.message || 'Invoice nahi ban paya.', 'error');
    }
  }

  window.MCInvoice = { html, open };
})();
