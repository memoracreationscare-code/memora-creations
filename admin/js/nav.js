/*
  One shared admin menu for every admin page.
  It replaces each page's own (different) menu, so the order and the names
  are the same everywhere. To add or remove a page, edit GROUPS below.
*/
(() => {
  if (document.getElementById('mcAdminNav')) return;
  if (/\/admin\/(index\.html)?$/.test(location.pathname)) return; // login page

  const B = '/memora-creations/admin/';
  const GROUPS = [
    { title: '', items: [['dashboard.html', '▦', 'Dashboard']] },
    { title: 'Orders & Payments', items: [
      ['orders.html', '▣', 'Orders'],
      ['cancellation-requests.html', '✕', 'Cancellation Requests'],
      ['return-requests.html', '↩', 'Return Requests'],
      ['return-parcels.html', '📦', 'Return Parcels'],
      ['payments.html', '₹', 'Online Payments & Refunds'],
      ['cod-remittance.html', '💵', 'COD Remittance']
    ] },
    { title: 'Catalog & Marketing', items: [
      ['products.html', '◈', 'Products'],
      ['banners.html', '🖼', 'Homepage Banners'],
      ['coupons.html', '%', 'Coupons'],
      ['announcement.html', '📢', 'Announcement']
    ] },
    { title: 'Customers', items: [
      ['users.html', '♙', 'Customers'],
      ['reviews.html', '★', 'Reviews'],
      ['abandoned-carts.html', '🛒', 'Abandoned Carts'],
      ['wishlist.html', '♡', 'Wishlist']
    ] },
    { title: 'Website', items: [['settings.html', '⚙', 'Store Settings'],
      ['test-cleanup.html', '🧹', 'Test Orders Cleanup']] }
  ];

  const here = location.pathname.split('/').pop() || 'dashboard.html';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Pages that belong to a menu entry although they are not in the menu.
  const alias = { 'refund-management.html': 'payments.html', 'refund-initiation.html': 'payments.html' };
  const current = alias[here] || here;

  const style = document.createElement('style');
  style.textContent = `
    #mcAdminNav{position:fixed;inset:0 auto 0 0;width:248px;background:#2a1d15;color:#fff;z-index:900;
      display:flex;flex-direction:column;padding:18px 12px;overflow-y:auto;font-family:inherit;box-sizing:border-box}
    #mcAdminNav .nv-brand{padding:6px 10px 14px;border-bottom:1px solid rgba(255,255,255,.12);margin-bottom:6px}
    #mcAdminNav .nv-brand b{display:block;font-size:20px;letter-spacing:2px}
    #mcAdminNav .nv-brand small{font-size:10px;letter-spacing:2px;color:#d9b48f}
    #mcAdminNav .nv-title{font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#b99c84;margin:14px 10px 4px}
    #mcAdminNav a,#mcAdminNav button{display:flex;align-items:center;gap:10px;color:#f3e8de;text-decoration:none;
      padding:9px 10px;border-radius:9px;font-size:14px;font-weight:600;border:0;background:none;cursor:pointer;width:100%;text-align:left;font-family:inherit;box-sizing:border-box}
    #mcAdminNav a:hover,#mcAdminNav button:hover{background:rgba(255,255,255,.09)}
    #mcAdminNav a.on{background:#9a6540;color:#fff}
    #mcAdminNav .nv-ic{width:20px;text-align:center;flex:none}
    #mcAdminNav .nv-foot{margin-top:auto;padding-top:14px;border-top:1px solid rgba(255,255,255,.12)}
    #mcNavBar{display:none}
    body.mc-has-nav{padding-left:248px !important;margin:0}
    @media(max-width:900px){
      body.mc-has-nav{padding-left:0 !important;padding-top:52px !important}
      #mcAdminNav{transform:translateX(-100%);transition:transform .2s;box-shadow:0 0 30px rgba(0,0,0,.4)}
      body.mc-nav-open #mcAdminNav{transform:none}
      #mcNavBar{display:flex;position:fixed;top:0;left:0;right:0;height:52px;background:#2a1d15;color:#fff;align-items:center;gap:12px;padding:0 14px;z-index:899;font-weight:700}
      #mcNavBar button{background:none;border:0;color:#fff;font-size:24px;cursor:pointer}
    }`;
  document.head.appendChild(style);

  // Remove the old per-page menus.
  document.querySelectorAll('nav.adminnav, .mc-sidebar, aside.sidebar, .announcement-sidebar').forEach(n => n.remove());

  const nav = document.createElement('aside');
  nav.id = 'mcAdminNav';
  nav.setAttribute('aria-label', 'Admin menu');
  nav.innerHTML = `<div class="nv-brand"><b>MEMORA</b><small>CREATIONS ADMIN</small></div>` +
    GROUPS.map(g => (g.title ? `<div class="nv-title">${esc(g.title)}</div>` : '') +
      g.items.map(([file, ic, label]) =>
        `<a href="${B}${file}" class="${file === current ? 'on' : ''}" ${file === current ? 'aria-current="page"' : ''}><span class="nv-ic">${ic}</span>${esc(label)}</a>`
      ).join('')).join('') +
    `<div class="nv-foot">
       <a href="/memora-creations/frontend/index.html" target="_blank" rel="noopener"><span class="nv-ic">↗</span>View Store</a>
       <button type="button" id="mcNavLogout"><span class="nv-ic">⎋</span>Logout</button>
     </div>`;

  const bar = document.createElement('div');
  bar.id = 'mcNavBar';
  bar.innerHTML = '<button type="button" aria-label="Menu">☰</button><span>MEMORA ADMIN</span>';

  document.body.classList.add('mc-has-nav');
  document.body.prepend(bar);
  document.body.prepend(nav);

  bar.querySelector('button').onclick = () => document.body.classList.toggle('mc-nav-open');
  nav.addEventListener('click', e => { if (e.target.closest('a')) document.body.classList.remove('mc-nav-open'); });
  document.getElementById('mcNavLogout').onclick = async () => {
    try {
      if (window.MC && window.MC.api) await window.MC.api('/admin/logout', { method: 'POST' });
      else await fetch('https://memora-creations.onrender.com/api/admin/logout', { method: 'POST', credentials: 'include' });
    } catch (_) {}
    location.href = B + 'index.html';
  };

  // Let alerts.js put its red numbers on the new links.
  window.dispatchEvent(new Event('mc-nav-ready'));
})();
