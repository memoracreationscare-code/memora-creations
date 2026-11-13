(async () => {
  const { api, esc, toast } = window.MC;
  const wrap = document.querySelector('.customers-table-wrap');

  if (!wrap) return;

  const money = n => '₹' + Number(n || 0).toLocaleString('en-IN');
  const box = document.createElement('section');

  box.style.cssText = 'background:#fff;border:1px solid #e9dfd4;border-radius:16px;padding:18px;margin:0 0 18px';
  box.innerHTML = '<b>📈 Customer insights</b><div id="cxBody" style="margin-top:10px;color:#81776f">Loading…</div>';
  wrap.parentNode.insertBefore(box, wrap);

  try {
    const { summary: s } = await api('/admin/customers/summary');
    const rows = s.top.map((c, i) => `<tr><td>${i + 1}</td><td>${esc(c.name)}</td><td>${esc(c.mobile)}</td>
      <td style="text-align:right">${c.orders}</td><td style="text-align:right">${money(c.spent)}</td></tr>`).join('');

    document.getElementById('cxBody').innerHTML = `
      <div style="display:flex;gap:12px;flex-wrap:wrap;color:#302117">
        <div style="flex:1;min-width:130px"><small>Kharidne wale</small><br><b style="font-size:22px">${s.buyers}</b></div>
        <div style="flex:1;min-width:130px"><small>Dobara kharidne wale</small><br><b style="font-size:22px">${s.repeatBuyers}</b> <small>(${s.repeatRate}%)</small></div>
        <div style="flex:1;min-width:130px"><small>Kul kharid</small><br><b style="font-size:22px">${money(s.totalSpent)}</b></div>
      </div>
      ${rows ? `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:14px;color:#302117">
        <thead><tr style="background:#f5eee8"><th style="padding:8px;text-align:left">#</th><th style="text-align:left">Top customers</th><th style="text-align:left">Mobile</th><th style="text-align:right">Orders</th><th style="text-align:right;padding-right:8px">Kul kharid</th></tr></thead>
        <tbody>${rows}</tbody></table></div>` : '<p>Abhi koi order nahi hai.</p>'}
      <p style="margin:12px 0 0"><button id="cxCsv" type="button" style="border:0;border-radius:10px;padding:10px 16px;font-weight:700;cursor:pointer;background:#805137;color:#fff">⬇ Customer list (CSV) download</button></p>`;

    document.getElementById('cxCsv').addEventListener('click', async () => {
      try {
        const r = await fetch('https://api.memoracreationscare.in/api/admin/customers/export', { credentials: 'include' });
        if (!r.ok) throw new Error('Download nahi hua.');
        const url = URL.createObjectURL(await r.blob());
        const a = Object.assign(document.createElement('a'), { href: url, download: 'memora-customers.csv' });
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      } catch (e) { toast(e.message, 'error'); }
    });
  } catch (e) {
    document.getElementById('cxBody').textContent = e.message || 'Insights load nahi hue.';
  }
})();
