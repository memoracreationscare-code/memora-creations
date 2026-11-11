(async () => {
  const { api, $, esc, toast } = window.MC;

  try { await window.requireAdmin(); } catch (_) { return; }

  const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const ymd = d => d.toISOString().slice(0, 10);
  const istNow = () => new Date(Date.now() + 5.5 * 3600 * 1000);
  let data = null;

  function setRange(from, to) { $('#from').value = ymd(from); $('#to').value = ymd(to); }

  function thisMonth() {
    const n = istNow();
    setRange(new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1)), n);
  }

  const fill = (id, rows, cells) => {
    $(id).innerHTML = rows.map(r => '<tr>' + cells(r).map((c, i) => `<td class="${i ? 'n' : ''}">${c}</td>`).join('') + '</tr>').join('') ||
      '<tr><td colspan="3">Is dauran koi sale nahi.</td></tr>';
  };

  async function show() {
    $('#msg').textContent = 'Dekh raha hu...';

    try {
      data = await api(`/admin/reports?from=${$('#from').value}&to=${$('#to').value}`);
      const s = data.summary;

      $('#cards').innerHTML = [
        ['Total sale', inr(s.revenue)], ['Orders', s.orders],
        ['Ek order ka average', inr(s.average)], ['Cancel hue', s.cancelled]
      ].map(([a, b]) => `<div class="card"><span class="muted">${a}</span><b>${esc(b)}</b></div>`).join('');

      fill('#products', data.products, r => [esc(r.name), r.quantity, inr(r.revenue)]);
      fill('#states', data.states, r => [esc(r.state), r.orders, inr(r.revenue)]);
      fill('#payments', data.payments, r => [esc(r.method), r.orders, inr(r.revenue)]);
      fill('#days', data.days, r => [esc(r.date), r.orders, inr(r.revenue)]);
      $('#msg').textContent = '';
    } catch (e) {
      $('#msg').textContent = e.message || 'Report nahi aayi.';
    }
  }

  $('#show').onclick = show;
  $('#month').onclick = () => { thisMonth(); show(); };
  $('#last').onclick = () => {
    const n = istNow();
    setRange(new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - 1, 1)), new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 0)));
    show();
  };

  $('#csv').onclick = () => {
    if (!data) return toast('Pehle "Dikhao" dabayein.', 'warning');

    // =, +, -, @ at the start would run as a formula in Excel: prefix a quote
    const cell = v => {
      const t = String(v ?? '');
      const safe = /^[=+\-@]/.test(t) ? "'" + t : t;
      return /[",\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
    };
    const lines = [['Report', `${$('#from').value} to ${$('#to').value}`], ['Total sale', data.summary.revenue], ['Orders', data.summary.orders], [],
      ['Product', 'Quantity', 'Revenue'], ...data.products.map(p => [p.name, p.quantity, p.revenue]), [],
      ['State', 'Orders', 'Revenue'], ...data.states.map(p => [p.state, p.orders, p.revenue]), [],
      ['Payment', 'Orders', 'Revenue'], ...data.payments.map(p => [p.method, p.orders, p.revenue]), [],
      ['Date', 'Orders', 'Revenue'], ...data.days.map(p => [p.date, p.orders, p.revenue])];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + lines.map(r => r.map(cell).join(',')).join('\n')], { type: 'text/csv' }));
    a.download = `memora-report-${$('#from').value}-to-${$('#to').value}.csv`;
    a.click();
  };

  thisMonth();
  show();
})();
