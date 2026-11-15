/*
  Recently viewed products + "Install app" banner.

  Admin switches (Settings -> Customer convenience):
    recentViewedEnabled, installAppEnabled

  Only product ids are stored in the browser; name, price and stock are
  fetched fresh when shown, so nothing is ever out of date.
*/
(() => {
  const API_ROOT = 'https://api.memoracreationscare.in/api';
  const KEY = 'mc_recent';
  const MAX = 10;
  const SHOW = 6;

  const read = () => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(v) ? v.filter(x => typeof x === 'string' && /^[a-f0-9]{24}$/i.test(x)) : [];
    } catch (_) { return []; }
  };
  const write = ids => { try { localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX))); } catch (_) {} };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => '₹' + Number(n || 0).toLocaleString('en-IN');

  let settings = { recentViewedEnabled: true, installAppEnabled: true };
  const ready = fetch(API_ROOT + '/settings')
    .then(r => r.json())
    .then(d => {
      const s = (d && (d.settings || d.data || d)) || {};
      settings = {
        recentViewedEnabled: s.recentViewedEnabled !== false,
        installAppEnabled: s.installAppEnabled !== false
      };
    })
    .catch(() => {});

  const style = document.createElement('style');
  style.textContent = `
    .mc-recent{margin:30px 0 8px}
    .mc-recent h2{margin:0 0 12px;font-size:20px}
    .mc-recent-row{display:flex;gap:12px;overflow-x:auto;padding:2px 2px 10px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}
    .mc-recent-card{flex:0 0 138px;scroll-snap-align:start;text-decoration:none;color:inherit;background:#fff;border-radius:14px;padding:8px;box-shadow:0 4px 14px rgba(0,0,0,.07);min-width:0}
    .mc-recent-card img{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:10px;display:block;background:#f3ece4}
    .mc-recent-card b{display:block;margin-top:7px;font-size:13px;line-height:1.3;font-weight:600;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
    .mc-recent-card span{display:block;font-size:13px;margin-top:3px;color:#8a5a3b;font-weight:700}
    .mc-install{position:fixed;left:12px;right:12px;bottom:calc(92px + env(safe-area-inset-bottom,0px));z-index:900;max-width:460px;margin:0 auto;background:#2b1d14;color:#fff;border-radius:16px;padding:12px 14px;display:flex;gap:12px;align-items:center;box-shadow:0 10px 30px rgba(0,0,0,.28)}
    .mc-install img{width:40px;height:40px;border-radius:10px;flex:none}
    .mc-install div{flex:1;min-width:0;font-size:13px;line-height:1.35}
    .mc-install b{display:block;font-size:14px}
    .mc-install button{border:0;border-radius:10px;padding:8px 14px;font:inherit;font-weight:700;font-size:13px;cursor:pointer}
    .mc-install .go{background:#d7a46c;color:#2b1d14}
    .mc-install .no{background:transparent;color:#cdbba9;padding:8px 6px}
  `;
  document.head.appendChild(style);

  async function fetchProduct(id) {
    try {
      const r = await fetch(API_ROOT + '/products/' + encodeURIComponent(id));
      if (!r.ok) return null;
      const d = await r.json();
      const p = d.product || (d.data && d.data.product) || null;
      return p && p._id ? p : null;
    } catch (_) { return null; }
  }

  async function render(host, excludeId, where) {
    await ready;
    if (!settings.recentViewedEnabled || !host) return;
    document.querySelectorAll('.mc-recent').forEach(n => n.remove());
    const ids = read().filter(id => id !== excludeId).slice(0, SHOW + 2);
    if (!ids.length) return;
    const found = (await Promise.all(ids.map(fetchProduct))).filter(Boolean).slice(0, SHOW);
    if (!found.length) return;
    const sec = document.createElement('section');
    sec.className = 'mc-recent';
    sec.innerHTML = `<h2>Recently viewed</h2><div class="mc-recent-row">` + found.map(p =>
      `<a class="mc-recent-card" href="/frontend/product.html?id=${encodeURIComponent(p._id)}">
         <img src="${esc((window.MC && window.MC.optImg ? window.MC.optImg(p.images && p.images[0] && p.images[0].url, 300) : (p.images && p.images[0] && p.images[0].url)) || '/frontend/images/logo.png')}" alt="${esc(p.name)}" loading="lazy">
         <b>${esc(p.name)}</b><span>${money(p.sellingPrice)}</span></a>`).join('') + `</div>`;
    if (where === 'before') host.parentNode.insertBefore(sec, host);
    else host.appendChild(sec);
  }

  window.MCRecent = {
    add(product) {
      const id = product && String(product._id || '');
      if (!id || !/^[a-f0-9]{24}$/i.test(id)) return;
      write([id].concat(read().filter(x => x !== id)));
    },
    render
  };

  /* home page: show the strip above the FAQ */
  document.addEventListener('DOMContentLoaded', () => {
    const faq = document.getElementById('faq');
    if (faq && /index\.html$|\/frontend\/?$/.test(location.pathname)) render(faq, null, 'before');
  });

  /* ---------- install app ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/frontend/sw.js', { scope: '/frontend/' }).catch(() => {}));
  }

  const DISMISS = 'mc_install_dismissed';
  let deferred = null;
  window.addEventListener('beforeinstallprompt', async e => {
    e.preventDefault();
    deferred = e;
    await ready;
    if (!settings.installAppEnabled) return;
    try { if (Date.now() - Number(localStorage.getItem(DISMISS) || 0) < 14 * 864e5) return; } catch (_) {}
    if (!/index\.html$|\/frontend\/?$/.test(location.pathname)) return;
    const bar = document.createElement('div');
    bar.className = 'mc-install';
    bar.setAttribute('role', 'dialog');
    bar.innerHTML = `<img src="/frontend/images/favicon-192.png" alt=""><div><b>Memora app install karo</b>Home screen se ek tap me kholo</div><button class="go" type="button">Install</button><button class="no" type="button" aria-label="Baad me">Baad me</button>`;
    bar.querySelector('.go').onclick = async () => {
      bar.remove();
      try { deferred.prompt(); await deferred.userChoice; } catch (_) {}
      deferred = null;
    };
    bar.querySelector('.no').onclick = () => {
      bar.remove();
      try { localStorage.setItem(DISMISS, String(Date.now())); } catch (_) {}
    };
    document.body.appendChild(bar);
  });
})();
