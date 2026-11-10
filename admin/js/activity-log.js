(async () => {
  const { api, $, esc } = window.MC;

  try { await window.requireAdmin(); } catch (_) { return; }

  let all = [];

  const draw = () => {
    const q = $('#q').value.trim().toLowerCase();
    const rows = all.filter(a => !q || `${a.action} ${a.admin} ${a.targetId} ${a.path}`.toLowerCase().includes(q));

    $('#rows').innerHTML = rows.map(a => `<tr>
      <td>${esc(new Date(a.at).toLocaleString('en-IN'))}</td>
      <td>${esc(a.admin || '')}</td>
      <td><b>${esc(a.action)}</b></td>
      <td>${a.targetId ? `<code>${esc(a.targetId)}</code>` : ''}</td>
    </tr>`).join('') || '<tr><td colspan="4">Koi record nahi mila.</td></tr>';
  };

  try {
    all = (await api('/admin/activity?limit=300')).activity || [];
    draw();
  } catch (e) {
    $('#rows').innerHTML = `<tr><td colspan="4">${esc(e.message || 'Load nahi hua')}</td></tr>`;
  }

  $('#q').addEventListener('input', draw);
})();
