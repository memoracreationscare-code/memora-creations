/*
  Dashboard "Launch check": is the shop really ready for customers?
  Hidden when everything is fine (shows one green line).
*/
(async () => {
  const { api, esc } = window.MC;
  const anchor = document.getElementById('stats')?.previousElementSibling;

  if (!anchor) return;

  try {
    const d = await api('/admin/launch-check');
    const wrap = document.createElement('section');
    const problems = d.checks.filter(c => c.level !== 'ok');
    const base = '/memora-creations/admin/';
    const style = document.createElement('style');

    style.textContent = `
      .lc{margin:0 0 22px;border-radius:16px;padding:16px 18px;border:1px solid #eadfd4;background:#fff}
      .lc.bad{border-color:#e8a29b;background:#fff4f2}.lc.warn{border-color:#ecd08a;background:#fffaf0}.lc.ok{border-color:#b9dfc3;background:#f1faf3}
      .lc h2{margin:0 0 8px;font-size:18px}
      .lc li{margin:7px 0;line-height:1.5}.lc small{color:#6b5d52;display:block}
      .lc .tag{font-weight:800;margin-right:6px}.lc .tag.bad{color:#b42318}.lc .tag.warn{color:#b26a00}`;
    document.head.appendChild(style);

    if (!problems.length) {
      wrap.className = 'lc ok';
      wrap.innerHTML = '<b>✅ Launch check: sab theek hai.</b> Payment, shipping, email aur products taiyar hain.';
    } else {
      wrap.className = 'lc ' + (d.summary.bad ? 'bad' : 'warn');
      wrap.innerHTML = `<h2>${d.summary.bad ? '🚨' : '⚠️'} Launch se pehle ye dekhein (${problems.length})</h2><ul style="padding-left:20px;margin:0">` +
        problems.map(c => `<li><span class="tag ${c.level}">${c.level === 'bad' ? 'ZARURI' : 'DHYAN'}</span><b>${esc(c.title)}</b><small>${esc(c.detail)}${c.link ? ` <a href="${base}${esc(c.link)}">Kholo →</a>` : ''}</small></li>`).join('') + '</ul>';
    }

    anchor.before(wrap);
  } catch (_) {
    // the check is a helper: never break the dashboard
  }
})();
