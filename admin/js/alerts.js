/*
  Admin alerts: shows a red number on the menu links and a banner at the
  top of the page when customers have sent cancellation or return requests
  that are still waiting for the owner. Refreshes every 60 seconds.
*/
(() => {

  const BASE = '/admin/';
  const ITEMS = [
    { key: 'returns', page: 'return-requests.html', label: 'return/replacement request' },
    { key: 'lowStock', page: 'products.html', label: 'product low on stock (3 or less)' },
    { key: 'cancelFollowUps', page: 'cancellation-requests.html', label: 'cancelled order needs a refund/Shiprocket check' },
    { key: 'cancellations', page: 'cancellation-requests.html', label: 'cancellation request' }
  ];

  const originalTitle = document.title;

  function injectStyle() {
    if (document.getElementById('mcAlertStyle')) return;

    const style = document.createElement('style');
    style.id = 'mcAlertStyle';
    style.textContent = `
      .mc-alert-badge{display:inline-block;min-width:20px;padding:1px 6px;margin-left:8px;
        border-radius:999px;background:#d62828;color:#fff;font-size:12px;font-weight:800;
        line-height:18px;text-align:center;vertical-align:middle;animation:mcAlertPulse 1.6s infinite}
      @keyframes mcAlertPulse{50%{transform:scale(1.15)}}
      #mcAlertBanner{margin:12px auto;max-width:1200px;padding:14px 18px;border-radius:12px;
        background:#fff1f0;border:2px solid #d62828;color:#5c1010;font-weight:700;
        display:flex;gap:12px;align-items:center;flex-wrap:wrap}
      #mcAlertBanner a{color:#fff;background:#d62828;padding:8px 14px;border-radius:8px;
        text-decoration:none;font-weight:800}
      @media (prefers-reduced-motion:reduce){.mc-alert-badge{animation:none}}
    `;
    document.head.appendChild(style);
  }

  function setBadges(counts) {
    ITEMS.forEach(item => {
      document.querySelectorAll(`a[href*="${item.page}"]`).forEach(link => {
        if (link.closest('#mcAlertBanner')) return;

        let badge = link.querySelector('.mc-alert-badge');
        const n = Number(counts[item.key] || 0);

        if (!n) { if (badge) badge.remove(); return; }

        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'mc-alert-badge';
          link.appendChild(badge);
        }

        badge.textContent = n;
      });
    });
  }

  function setBanner(counts) {
    let banner = document.getElementById('mcAlertBanner');
    const active = ITEMS.filter(i => Number(counts[i.key] || 0) > 0);

    if (!active.length) { if (banner) banner.remove(); return; }

    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'mcAlertBanner';
      banner.setAttribute('role', 'alert');

      const main = document.querySelector('main');
      (main || document.body).prepend(banner);
    }

    banner.replaceChildren();

    const text = document.createElement('span');
    text.textContent = '🔔 Aapka dhyan chahiye:';
    banner.appendChild(text);

    active.forEach(item => {
      const n = Number(counts[item.key]);
      const link = document.createElement('a');
      link.href = BASE + item.page;
      link.textContent = `${n} ${item.label}${n === 1 ? '' : 's'} →`;
      banner.appendChild(link);
    });
  }

  async function refresh() {
    try {
      const counts = await window.MC.api('/admin/pending-counts');
      const total = ITEMS.reduce((sum, i) => sum + Number(counts[i.key] || 0), 0);

      injectStyle();
      setBadges(counts);
      setBanner(counts);
      document.title = total ? `(${total}) ${originalTitle}` : originalTitle;

    } catch {
      /* not logged in or server asleep: stay silent */
    }
  }

  if (/\/admin\/(index\.html)?$/.test(location.pathname)) return;

  function start() {
    setTimeout(refresh, 600);
    setInterval(() => { if (!document.hidden) refresh(); }, 60000);
  }

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);

})();
