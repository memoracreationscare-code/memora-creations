/* Trust badges on the product page. Admin switch: trustBadgesEnabled.
   Return days and COD come from the live settings, so the text never lies. */
(() => {
  const root = (window.MC && window.MC.API_BASE) || 'https://api.memoracreationscare.in/api';
  const style = document.createElement('style');
  style.textContent = `.mc-trust{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:14px 0}
.mc-trust div{display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid #eadfce;border-radius:12px;background:#fffaf3;font-size:13px;line-height:1.35;color:#3b2a1d}
.mc-trust span{font-size:18px}`;
  document.head.appendChild(style);

  function build(s) {
    const days = Number(s.returnWindowDays);
    const items = [];
    if (days > 0) items.push(['↩️', `${days} din me return / replacement`]);
    items.push(['🔒', 'Secure online payment']);
    if (s.codEnabled !== false) items.push(['💵', 'Cash on Delivery available']);
    items.push(['✅', 'Dispatch se pehle quality check']);
    const box = document.createElement('section');
    box.className = 'mc-trust';
    items.forEach(([icon, text]) => {
      const d = document.createElement('div');
      const i = document.createElement('span'); i.textContent = icon;
      d.appendChild(i); d.appendChild(document.createTextNode(text));
      box.appendChild(d);
    });
    return box;
  }

  function place(box) {
    const host = document.querySelector('#product');
    if (!host) return false;
    const actions = host.querySelector('.actions');
    if (!actions || !actions.parentElement) return false;
    if (host.querySelector('.mc-trust')) return true;
    actions.parentElement.insertBefore(box, actions.nextSibling);
    return true;
  }

  fetch(root + '/settings').then(r => r.json()).then(d => {
    const s = (d && (d.settings || d.data || d)) || {};
    if (s.trustBadgesEnabled === false) return;
    const box = build(s);
    if (place(box)) return;
    const host = document.querySelector('#product');
    if (!host) return;
    const mo = new MutationObserver(() => { if (place(box)) mo.disconnect(); });
    mo.observe(host, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 15000);
  }).catch(() => {});
})();
