/*
  Admin pop-ups: toast messages, confirm and prompt dialogs.
  - window.mcToast(message, type)   type: success | error | warning | message
  - window.mcConfirm(message, opts) -> Promise<boolean>
  - window.mcPrompt(message, opts)  -> Promise<string|null>
  app.js's toast() hands over to mcToast, so every existing "toast(...)" call
  in the admin now shows a floating message with an icon instead of a bar at
  the top of the page. window.alert is also shown as a dialog.
*/
(() => {
  if (window.mcToast) return;

  const style = document.createElement('style');
  style.textContent = `
    #mcToasts{position:fixed;top:16px;right:16px;z-index:100000;display:flex;flex-direction:column;gap:10px;width:min(380px,calc(100vw - 32px));pointer-events:none}
    .mc-t{pointer-events:auto;display:flex;gap:12px;align-items:flex-start;background:#fff;color:#302117;border-radius:14px;padding:13px 14px;
      box-shadow:0 12px 36px rgba(48,33,23,.22);border:1px solid #eadfd4;border-left:5px solid #805137;position:relative;overflow:hidden;
      animation:mcIn .22s ease-out;font:600 14px/1.45 Arial,sans-serif}
    .mc-t.success{border-left-color:#1f9d55}.mc-t.error{border-left-color:#c0362c}.mc-t.warning{border-left-color:#d98e04}
    .mc-t .ic{flex:none;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:14px;background:#805137}
    .mc-t.success .ic{background:#1f9d55}.mc-t.error .ic{background:#c0362c}.mc-t.warning .ic{background:#d98e04}
    .mc-t .tx{flex:1;word-break:break-word;padding-top:2px}
    .mc-t .x{background:none;border:0;font-size:20px;line-height:1;color:#8a7c70;cursor:pointer;padding:0 2px}
    .mc-t .bar{position:absolute;left:0;bottom:0;height:3px;background:rgba(48,33,23,.18);animation:mcBar linear forwards}
    .mc-t.out{opacity:0;transform:translateX(30px);transition:.2s}
    @keyframes mcIn{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:none}}
    @keyframes mcBar{from{width:100%}to{width:0}}
    .mc-ov{position:fixed;inset:0;background:rgba(30,20,13,.55);z-index:100001;display:grid;place-items:center;padding:16px;animation:mcFade .15s}
    @keyframes mcFade{from{opacity:0}to{opacity:1}}
    .mc-dlg{background:#fff;color:#302117;border-radius:18px;width:min(440px,100%);padding:22px;box-shadow:0 24px 70px rgba(0,0,0,.35);font-family:Arial,sans-serif}
    .mc-dlg h3{margin:0 0 8px;font-size:19px}
    .mc-dlg p{margin:0 0 14px;white-space:pre-line;line-height:1.55;color:#5b4a3e;font-size:14.5px}
    .mc-dlg input{width:100%;box-sizing:border-box;padding:11px;border:1px solid #d9c9bd;border-radius:10px;font-size:15px;margin-bottom:14px}
    .mc-dlg .row{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}
    .mc-dlg button{border:0;border-radius:10px;padding:11px 18px;font-weight:700;font-size:14px;cursor:pointer;background:#805137;color:#fff}
    .mc-dlg button.no{background:#f1e8df;color:#302117}.mc-dlg button.danger{background:#c0362c}
    @media(prefers-reduced-motion:reduce){.mc-t,.mc-ov{animation:none}}`;
  document.head.appendChild(style);

  const ICONS = { success: '✓', error: '✕', warning: '!', message: 'i' };

  function box() {
    let b = document.getElementById('mcToasts');
    if (!b) {
      b = document.createElement('div');
      b.id = 'mcToasts';
      b.setAttribute('aria-live', 'polite');
      document.body.appendChild(b);
    }
    return b;
  }

  window.mcToast = function (message, type = 'message') {
    if (!document.body) return;
    const kind = ICONS[type] ? type : 'message';
    const ms = kind === 'error' ? 7000 : 4000;
    const el = document.createElement('div');
    el.className = 'mc-t ' + kind;
    el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    const ic = document.createElement('span'); ic.className = 'ic'; ic.textContent = ICONS[kind];
    const tx = document.createElement('span'); tx.className = 'tx'; tx.textContent = String(message ?? '');
    const x = document.createElement('button'); x.className = 'x'; x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.textContent = '×';
    const bar = document.createElement('i'); bar.className = 'bar'; bar.style.animationDuration = ms + 'ms';
    el.append(ic, tx, x, bar);
    const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 220); };
    x.onclick = close;
    box().appendChild(el);
    while (box().children.length > 4) box().firstChild.remove();
    setTimeout(close, ms);
  };

  function dialog({ title, message, ok = 'OK', cancel = 'Cancel', danger = false, input = null, single = false }) {
    return new Promise(resolve => {
      const prev = document.activeElement;
      const ov = document.createElement('div');
      ov.className = 'mc-ov';
      const d = document.createElement('div');
      d.className = 'mc-dlg';
      d.setAttribute('role', 'dialog');
      d.setAttribute('aria-modal', 'true');
      const h = document.createElement('h3'); h.textContent = title;
      const p = document.createElement('p'); p.textContent = message || '';
      d.append(h, p);
      let field = null;
      if (input) {
        field = document.createElement('input');
        field.value = input.value || '';
        field.placeholder = input.placeholder || '';
        d.appendChild(field);
      }
      const row = document.createElement('div'); row.className = 'row';
      const no = document.createElement('button'); no.type = 'button'; no.className = 'no'; no.textContent = cancel;
      const yes = document.createElement('button'); yes.type = 'button'; yes.textContent = ok;
      if (danger) yes.className = 'danger';
      if (!single) row.appendChild(no);
      row.appendChild(yes);
      d.appendChild(row);
      ov.appendChild(d);
      document.body.appendChild(ov);

      const done = value => {
        document.removeEventListener('keydown', key, true);
        ov.remove();
        if (prev && prev.focus) prev.focus();
        resolve(value);
      };
      const key = e => {
        if (e.key === 'Escape') { e.preventDefault(); done(single ? true : (field ? null : false)); }
        if (e.key === 'Enter' && e.target !== no) { e.preventDefault(); yes.click(); }
      };
      document.addEventListener('keydown', key, true);
      yes.onclick = () => done(field ? field.value : true);
      no.onclick = () => done(field ? null : false);
      ov.addEventListener('mousedown', e => { if (e.target === ov && !single) no.click(); });
      (field || (danger ? no : yes)).focus();
    });
  }

  window.mcConfirm = (message, opts = {}) => dialog({
    title: opts.title || 'Pakka karna hai?',
    message,
    ok: opts.okText || 'Haan, karo',
    cancel: opts.cancelText || 'Nahi',
    danger: Boolean(opts.danger)
  });

  window.mcPrompt = (message, opts = {}) => dialog({
    title: opts.title || 'Details likhein',
    message,
    ok: opts.okText || 'OK',
    cancel: opts.cancelText || 'Cancel',
    input: { value: opts.defaultValue || '', placeholder: opts.placeholder || '' }
  });

  // Plain alert() -> dialog (cannot block, which is fine for a notice).
  window.alert = message => { dialog({ title: 'Dhyan dein', message: String(message ?? ''), ok: 'Theek hai', single: true }); };
})();

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
      ['reports.html', '📊', 'Reports'],
      ['cod-remittance.html', '💵', 'COD Remittance']
    ] },
    { title: 'Catalog & Marketing', items: [
      ['products.html', '◈', 'Products'],
      ['product-import.html', '⇪', 'Import Products (CSV)'],
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
      ['activity-log.html', '🕘', 'Activity Log'],
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

  // Standalone pages (coupons, wishlist) have no login check of their own:
  // send visitors without an admin session to the login page.
  if (!window.requireAdmin) {
    fetch('https://memora-creations.onrender.com/api/admin/dashboard', { credentials: 'include' })
      .then(r => { if (r.status === 401 || r.status === 403) location.href = B + 'index.html'; })
      .catch(() => {});
  }
})();
