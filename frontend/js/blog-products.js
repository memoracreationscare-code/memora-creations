'use strict';

/*
  Blog articles: shows a few real products under the article.
  <div class="bl-products" data-q="frame"></div>  ->  GET /api/products?q=frame&limit=4
  If the shop cannot be reached or nothing matches, the block simply stays hidden.
*/

(() => {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rs = n => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  async function run(box) {
    const q = box.dataset.q || '';
    if (!q || !window.MC) return;
    try {
      const res = await fetch(window.MC.API_BASE + '/products?limit=4&q=' + encodeURIComponent(q));
      const data = await res.json();
      const list = ((data && data.products) || []).filter(p => p && p._id).slice(0, 4);
      if (!list.length) return;
      box.innerHTML = '<h3>Shop this look</h3><div class="bl-pgrid">' + list.map(p => {
        const img = p.images && p.images[0] && p.images[0].url;
        return `<a class="bl-pcard" href="/frontend/product.html?id=${encodeURIComponent(p._id)}">` +
          (img ? `<img src="${esc(window.MC.optImg ? window.MC.optImg(img, 400) : img)}" alt="${esc(p.name)}" loading="lazy">` : '') +
          `<span>${esc(p.name)}</span><b>${rs(p.sellingPrice)}</b></a>`;
      }).join('') + '</div>';
      box.hidden = false;
    } catch (_) { /* leave hidden */ }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.bl-products').forEach(run);
  });
})();
