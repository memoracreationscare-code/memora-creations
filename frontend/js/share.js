/*
  Share a product (home page cards, product list, product page).
  Any button with  data-share-id="<product id>"  and  data-share-name="<name>"
  opens the phone's own share sheet, or a small menu (WhatsApp / copy link).
  The shared link opens a page with the product photo, name and price preview.
*/
(() => {
  const API_ROOT = 'https://api.memoracreationscare.in/api';

  const style = document.createElement('style');

  style.textContent = `
    .mc-share-card{position:absolute;top:62px;right:12px;z-index:4;width:44px;height:44px;border-radius:999px;border:1px solid #e7d6ce;background:#fff;color:#71412c;font-size:22px;line-height:1;cursor:pointer;box-shadow:0 3px 12px #0002}
    .mc-share-card:focus-visible{outline:3px solid #9b613c;outline-offset:3px}
    .mc-share-menu{position:fixed;inset:0;background:#2a1d1599;z-index:99999;display:grid;place-items:end center;padding:12px}
    .mc-share-sheet{background:#fff;border-radius:18px;width:min(420px,100%);padding:18px;box-shadow:0 20px 60px #0005;font-family:inherit}
    .mc-share-sheet h3{margin:0 0 4px;font-size:18px}.mc-share-sheet p{margin:0 0 14px;color:#6b5d52;font-size:14px}
    .mc-share-sheet a,.mc-share-sheet button{display:block;width:100%;box-sizing:border-box;text-align:center;padding:13px;margin-top:8px;border-radius:11px;border:0;font-weight:700;font-size:15px;cursor:pointer;text-decoration:none;background:#f1e8df;color:#302117;font-family:inherit}
    .mc-share-sheet a.wa{background:#25d366;color:#fff}`;
  document.head.appendChild(style);

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t) => (window.MC && window.MC.toast ? window.MC.toast(m, t) : alert(m));

  async function shareProduct(id, name) {
    const url = API_ROOT + '/products/' + encodeURIComponent(id) + '/share';
    const text = `${name} - Memora Creations`;

    if (navigator.share) {
      try {
        await navigator.share({ title: text, text, url });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }

    const wrap = document.createElement('div');

    wrap.className = 'mc-share-menu';
    wrap.innerHTML = `<div class="mc-share-sheet" role="dialog" aria-modal="true" aria-label="Share">
      <h3>Share karein</h3><p>${esc(name)}</p>
      <a class="wa" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}">WhatsApp par bhejo</a>
      <button type="button" data-copy>Link copy karo</button>
      <button type="button" data-close>Band karo</button></div>`;
    document.body.appendChild(wrap);

    wrap.addEventListener('click', async event => {
      if (event.target === wrap || event.target.closest('[data-close]') || event.target.closest('a.wa')) return wrap.remove();

      if (event.target.closest('[data-copy]')) {
        try {
          await navigator.clipboard.writeText(url);
          toast('Link copy ho gaya.', 'success');
        } catch (_) {
          toast(url, 'message');
        }
        wrap.remove();
      }
    });
  }

  window.mcShareProduct = shareProduct;

  // capture phase: runs before the card's own "open product" click handlers
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-share-id]');

    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    shareProduct(button.dataset.shareId, button.dataset.shareName || 'Memora Creations');
  }, true);
})();
