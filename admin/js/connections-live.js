/*
  Dashboard "Live connections": really asks Shiprocket and Cashfree if the
  keys work and shows the Shiprocket wallet. Quiet when all is fine.
  Never breaks the dashboard.
*/
(() => {
  const { api, esc } = window.MC || {};
  const anchor = document.getElementById('stats')?.previousElementSibling;

  if (!api || !anchor) return;

  const wrap = document.createElement('section');
  const style = document.createElement('style');

  style.textContent = `
    .cl{margin:0 0 22px;border-radius:16px;padding:14px 18px;border:1px solid #eadfd4;background:#fff}
    .cl.bad{border-color:#e8a29b;background:#fff4f2}.cl.warn{border-color:#ecd08a;background:#fffaf0}.cl.ok{border-color:#b9dfc3;background:#f1faf3}
    .cl h2{margin:0 0 8px;font-size:17px}.cl ul{margin:0;padding-left:20px}.cl li{margin:6px 0;line-height:1.5}
    .cl button{border:1px solid #d9c6b5;background:#fff;border-radius:10px;padding:7px 12px;font:inherit;cursor:pointer;margin-top:8px}`;
  document.head.appendChild(style);

  async function run() {
    wrap.className = 'cl';
    wrap.textContent = '🔌 Shiprocket aur Cashfree ki jaanch ho rahi hai...';

    try {
      const d = await api('/admin/connections');
      const worst = d.summary.bad ? 'bad' : d.summary.warn ? 'warn' : 'ok';
      const icon = { ok: '✅', warn: '⚠️', bad: '🚨' };

      wrap.className = 'cl ' + worst;
      wrap.innerHTML = `<h2>🔌 Live connections</h2><ul>` +
        d.checks.map(c => `<li>${icon[c.level]} <b>${esc(c.title)}</b>: ${esc(c.detail)}</li>`).join('') +
        `</ul><button type="button" id="clAgain">Dobara jaanchein</button>`;
      wrap.querySelector('#clAgain').addEventListener('click', run);
    } catch (_) {
      // Staff (no access) and network hiccups: stay silent, never break the dashboard.
      wrap.remove();
    }
  }

  anchor.before(wrap);
  run();
})();
