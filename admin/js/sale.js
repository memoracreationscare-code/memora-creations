(async () => {
  const { api, $, esc, toast } = window.MC;

  try { await window.requireAdmin(); } catch (_) { return; }

  const when = d => new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  async function load() {
    try {
      const { sale } = await api('/admin/sale');

      $('#newBox').hidden = !!sale;

      $('#current').innerHTML = sale
        ? `<div class="live"><b>🔥 ${esc(sale.name)}: ${esc(sale.percent)}% off</b><br>
            ${esc(when(sale.startsAt))} se ${esc(when(sale.endsAt))} tak<br>
            ${esc(sale.products)} product, abhi chalu: <b>${esc(sale.running)}</b>
            ${sale.running ? '' : '<br><small>Start time aate hi prices kam ho jayenge.</small>'}</div>
           <p><button id="stop" class="danger" type="button">Sale abhi band karo (price wapas normal)</button></p>`
        : '<span class="muted">Abhi koi sale nahi lagi hai.</span>';
    } catch (e) {
      $('#current').textContent = e.message || 'Load nahi hua.';
    }
  }

  try {
    const data = await api('/products/categories');

    $('#cat').insertAdjacentHTML('beforeend', (data.categories || []).map(c => `<option value="${esc(c._id)}">${esc(c.name)}</option>`).join(''));
  } catch (_) { /* optional */ }

  $('#current').addEventListener('click', async e => {
    if (!e.target.closest('#stop')) return;

    if (!(await window.mcConfirm('Sale band karke saare prices wapas normal kar dein?', { danger: true, okText: 'Haan, band karo' }))) return;

    try {
      const r = await api('/admin/sale', { method: 'DELETE' });

      toast(r.message, 'success');
      load();
    } catch (x) { toast(x.message, 'error'); }
  });

  $('#f').addEventListener('submit', async e => {
    e.preventDefault();

    const body = {
      name: $('#name').value,
      percent: Number($('#pct').value),
      categoryId: $('#cat').value || undefined,
      startsAt: $('#s').value ? new Date($('#s').value).toISOString() : '',
      endsAt: $('#e').value ? new Date($('#e').value).toISOString() : ''
    };

    if (!(await window.mcConfirm(`${body.name || 'Sale'}: ${body.percent}% off lagayein?\nStart: ${$('#s').value}\nEnd: ${$('#e').value}`, { okText: 'Haan, lagao' }))) return;

    try {
      const r = await api('/admin/sale', { method: 'POST', body: JSON.stringify(body) });

      toast(r.message, 'success');
      e.target.reset();
      load();
    } catch (x) { toast(x.message, 'error'); }
  });

  load();
})();
