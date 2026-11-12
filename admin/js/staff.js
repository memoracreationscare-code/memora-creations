(async () => {
  const { api, $, esc, toast } = window.MC;

  try { await window.requireAdmin(); } catch (_) { return; }

  async function load() {
    try {
      const { staff } = await api('/admin/staff');

      $('#rows').innerHTML = staff.map(s => `<tr>
        <td>${esc(s.name)}</td><td>${esc(s.email)}</td>
        <td>${s.lastLoginAt ? esc(new Date(s.lastLoginAt).toLocaleString('en-IN')) : '-'}</td>
        <td class="${s.isActive ? 'on' : 'off'}">${s.isActive ? 'Chalu' : 'Band'}</td>
        <td>
          <button class="sec" data-t="${esc(s.id)}">${s.isActive ? 'Band karo' : 'Chalu karo'}</button>
          <button class="sec" data-p="${esc(s.id)}">Password badlo</button>
        </td></tr>`).join('') || '<tr><td colspan="5">Abhi koi staff nahi hai.</td></tr>';
    } catch (e) {
      $('#rows').innerHTML = `<tr><td colspan="5">${esc(e.message)}</td></tr>`;
    }
  }

  $('#f').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const r = await api('/admin/staff', {
        method: 'POST',
        body: JSON.stringify({ name: $('#n').value, email: $('#e').value, password: $('#p').value })
      });
      toast(r.message, 'success');
      e.target.reset();
      load();
    } catch (x) { toast(x.message, 'error'); }
  });

  $('#rows').addEventListener('click', async e => {
    const t = e.target.closest('button[data-t]');
    const p = e.target.closest('button[data-p]');

    try {
      if (t) {
        const r = await api('/admin/staff/' + t.dataset.t + '/toggle', { method: 'PATCH' });
        toast(r.message, 'success');
        load();
      }
      if (p) {
        const pass = await window.mcPrompt('Naya password (8+ akshar):', { title: 'Password badlo' });
        if (!pass) return;
        const r = await api('/admin/staff/' + p.dataset.p + '/password', { method: 'PATCH', body: JSON.stringify({ password: pass }) });
        toast(r.message, 'success');
      }
    } catch (x) { toast(x.message, 'error'); }
  });

  load();
})();
