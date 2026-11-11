/*
  Dashboard "Aaj ka kaam": what needs doing now, and today's sales.
  Each card opens the page where the work is done.
*/
(async () => {
  const { api, esc } = window.MC;
  const anchor = document.getElementById('stats')?.previousElementSibling;

  if (!anchor) return;

  const money = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const O = '/memora-creations/admin/orders.html?status=';
  const style = document.createElement('style');

  style.textContent = `
    .td-wrap{margin:0 0 26px}
    .td-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}
    .td-card{display:block;text-decoration:none;color:#302117;background:#fff;border:1px solid #eadfd4;border-radius:16px;padding:16px;transition:.15s}
    .td-card:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(48,33,23,.12)}
    .td-card b{display:block;font-size:30px;line-height:1.1;margin:6px 0 2px}
    .td-card small{color:#81776f;font-weight:600}
    .td-card.hot{border-color:#e8a29b;background:#fff4f2}
    .td-card.hot b{color:#b42318}
    .td-card.ok b{color:#1b6e2d}
    .td-sales{background:#302117;color:#fff;border-color:#302117}
    .td-sales small{color:#e9d6c4}
    .td-up{color:#7ee2a0}.td-down{color:#ffb4ab}
    .td-card .mc-alert-badge{display:none}
    .td-note{margin:10px 2px 0;color:#81776f;font-size:13px}`;
  document.head.appendChild(style);

  const wrap = document.createElement('section');

  wrap.className = 'td-wrap';
  wrap.innerHTML = '<h2 class="mc-section-title">Aaj ka kaam</h2><div class="td-grid"><p>Loading...</p></div>';
  anchor.before(wrap);

  const grid = wrap.querySelector('.td-grid');

  try {
    const [t, c] = await Promise.all([api('/admin/today'), api('/admin/pending-counts')]);

    const diff = t.today.amount - t.yesterday.amount;
    const trend = t.yesterday.amount
      ? `<span class="${diff >= 0 ? 'td-up' : 'td-down'}">${diff >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(diff * 100 / t.yesterday.amount))}% kal se</span>`
      : 'Kal koi sale nahi';

    const cards = [
      { cls: 'td-sales', label: 'Aaj ki sales', value: money(t.today.amount), sub: `${t.today.orders} order · ${trend}`, href: O },
      { label: 'Ship karne hain', value: t.toShip, hot: t.toShip > 0, sub: 'Placed / Confirmed / Packed', href: O + encodeURIComponent('Order Placed,Confirmed,Packed') },
      { label: 'Raaste me', value: t.inTransit, sub: 'Shipped / Out for delivery', href: O + encodeURIComponent('Shipped,Out for Delivery') },
      { label: 'COD paisa aana baaki', value: t.codToCollect.orders, hot: t.codToCollect.orders > 0, sub: money(t.codToCollect.amount) + ' (Delivered, paisa mark nahi)', href: O + 'Delivered' },
      { label: 'Cancellation requests', value: c.cancellations || 0, hot: c.cancellations > 0, sub: 'Customer ne cancel manga', href: '/memora-creations/admin/cancellation-requests.html' },
      { label: 'Return requests', value: c.returns || 0, hot: c.returns > 0, sub: 'Return / replacement', href: '/memora-creations/admin/return-requests.html' },
      { label: 'Refund processing', value: t.refundsProcessing, sub: 'Cashfree me chal raha hai', href: '/memora-creations/admin/payments.html' },
      { label: 'Reviews approve karo', value: c.reviews || 0, hot: c.reviews > 0, sub: 'Customer ke naye reviews', href: '/memora-creations/admin/reviews.html' },
      { label: 'Stock kam', value: c.lowStock || 0, hot: c.lowStock > 0, sub: 'Products (3 ya kam bache)', href: '/memora-creations/admin/products.html' }
    ];

    grid.innerHTML = cards.map(x => {
      const cls = ['td-card', x.cls || '', x.hot ? 'hot' : (x.cls ? '' : (Number(x.value) === 0 ? 'ok' : ''))].join(' ');

      return `<a class="${cls}" href="${esc(x.href)}"><small>${esc(x.label)}</small><b>${esc(x.value)}</b><small>${x.sub}</small></a>`;
    }).join('');

    const total = [t.toShip, c.cancellations, c.returns, t.codToCollect.orders].reduce((a, n) => a + (Number(n) || 0), 0);

    wrap.insertAdjacentHTML('beforeend', `<p class="td-note">${total ? `Aapke dhyan ke liye ${total} kaam baaki hain.` : '✅ Sab kaam ho chuka hai.'}</p>`);
  } catch (e) {
    grid.innerHTML = `<p>Aaj ka kaam load nahi ho paya: ${esc(e.message || 'error')}</p>`;
  }
})();
