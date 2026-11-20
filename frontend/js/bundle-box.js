'use strict';

/*
  Product page: "Buy together and save" box.
  Shows active bundle offers that include this product (GET /api/bundles).
  The saving itself is applied by the server at checkout; this box only
  tells the customer about it and adds the items to the cart.
*/

(() => {
  const style = document.createElement('style');
  style.textContent = `
.mc-bundle{margin:16px 0;padding:14px 16px;border:1px dashed #c99a6b;border-radius:14px;background:#fff8ef}
.mc-bundle>b{display:block;font-size:14px;margin-bottom:4px;color:#3b2a1d}
.mc-bundle small{color:#7a6a58}
.mc-bundle-items{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:10px 0}
.mc-bundle-item{display:flex;flex-direction:column;align-items:center;width:84px;text-decoration:none;color:#3b2a1d;font-size:12px;text-align:center}
.mc-bundle-item img{width:64px;height:64px;object-fit:cover;border-radius:10px;border:1px solid #eadfce;background:#f6efe6}
.mc-bundle-plus{font-weight:700;color:#8a5a3b}
.mc-bundle-price{font-size:14px;color:#3b2a1d}
.mc-bundle-price s{color:#9a8b7b;margin-right:6px}
.mc-bundle-price em{font-style:normal;color:#1f7a4a;font-weight:700;margin-left:6px}
.mc-bundle button{margin-top:10px;padding:10px 18px;border:0;border-radius:10px;background:#8a5a3b;color:#fff;font-weight:700;cursor:pointer}
.mc-bundle button[disabled]{opacity:.6}`;
  document.head.appendChild(style);

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rs = n => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  function cardHtml(b) {
    const items = b.items.map(i =>
      `<a class="mc-bundle-item" href="/frontend/product.html?id=${encodeURIComponent(i._id)}">` +
      (i.image ? `<img src="${esc(i.image)}" alt="${esc(i.name)}" loading="lazy">` : '') +
      `<span>${esc(i.name)}</span></a>`).join('<span class="mc-bundle-plus">+</span>');
    const canAdd = b.items.every(i => i.inStock && !i.needsChoice);
    return `<section class="mc-bundle" data-id="${esc(b.id)}">
      <b>🎁 ${esc(b.name)}: saath me lo, ${rs(b.discount)} bachao</b>
      <div class="mc-bundle-items">${items}</div>
      <div class="mc-bundle-price"><s>${rs(b.total)}</s><strong>${rs(b.payable)}</strong><em>Aap bachate hain ${rs(b.discount)}</em></div>
      ${canAdd ? '<button type="button" data-add>Sab cart me daalo</button>'
               : '<small>Size / colour chunne ke liye har product par jaayein.</small>'}
      <div><small>Chhoot cart me apne aap lagti hai.</small></div>
    </section>`;
  }

  async function addAll(b, btn) {
    btn.disabled = true;
    try {
      for (const i of b.items) {
        await window.MC.api('/cart', { method: 'POST', body: JSON.stringify({ productId: i._id, quantity: 1 }) });
      }
      await window.MC.updateCartCount();
      window.MC.toast('Bundle cart me add ho gaya', 'success');
      if (typeof window.MC.showCartPopup === 'function') window.MC.showCartPopup();
    } catch (err) {
      if (err && [401, 403].includes(err.status)) {
        location.href = '/frontend/login.html?next=' + encodeURIComponent(location.pathname + location.search);
      } else {
        window.MC.toast((err && err.message) || 'Cart update nahi hua', 'error');
      }
    }
    btn.disabled = false;
  }

  async function mount(root, productId) {
    if (!root || !productId || root.querySelector('.mc-bundle')) return;
    let data;
    try {
      const res = await fetch(window.MC.API_BASE + '/bundles?productId=' + encodeURIComponent(productId));
      data = await res.json();
    } catch (_) { return; }
    const list = (data && data.bundles) || [];
    if (!list.length) return;

    const wrap = document.createElement('div');
    wrap.innerHTML = list.map(cardHtml).join('');
    const anchor = root.querySelector('.mc-pin') || root.querySelector('.actions');
    if (anchor && anchor.parentElement) anchor.parentElement.insertBefore(wrap, anchor);
    else root.appendChild(wrap);

    wrap.addEventListener('click', e => {
      const btn = e.target.closest('[data-add]');
      if (!btn) return;
      const b = list.find(x => x.id === btn.closest('.mc-bundle').dataset.id);
      if (b) addAll(b, btn);
    });
  }

  window.MCBundleBox = { mount, cardHtml };
})();
