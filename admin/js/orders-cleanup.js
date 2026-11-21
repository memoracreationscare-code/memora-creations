(async () => {
  const { api, $, esc, toast } = window.MC;

  try { await window.requireAdmin(); } catch (_) { return; }

  const money = n => Number(n || 0).toLocaleString('en-IN');
  const when = d => new Date(d).toLocaleString('en-IN');
  const iso = () => new Date($('#before').value).toISOString();
  let found = 0;

  function sync() {
    $('#del').disabled = !(found > 0 && $('#confirm').value.trim() === 'DELETE');
  }

  async function check() {
    $('#msg').textContent = 'Dekh raha hu...';
    $('#msg').className = '';
    try {
      const d = await api('/admin/test-orders?before=' + encodeURIComponent(iso()));
      found = d.count;
      $('#count').textContent = d.count;
      $('#total').textContent = money(d.total);
      $('#rows').innerHTML = d.orders.map(o =>
        `<tr><td>${esc(o.orderId)}</td><td>${when(o.createdAt)}</td><td>${esc(o.status)}</td><td>${esc(o.payment)}</td><td>₹${money(o.total)}</td></tr>`).join('')
        || '<tr><td colspan="5">Koi order nahi mila.</td></tr>';
      $('#more').textContent = d.count > d.orders.length ? `Pehle ${d.orders.length} dikhaye gaye hain.` : '';
      $('#skipBox').hidden = !d.skipped.length;
      $('#skipRows').innerHTML = d.skipped.map(o =>
        `<tr><td>${esc(o.orderId)}</td><td>${when(o.createdAt)}</td><td>${esc(o.payment)}</td><td>₹${money(o.total)}</td><td>${esc(o.why)}</td></tr>`).join('');
      $('#delBox').hidden = d.count === 0;
      $('#result').hidden = false;
      $('#msg').textContent = '';
      sync();
    } catch (e) {
      $('#msg').textContent = e.message || 'Check nahi ho paya.';
      $('#msg').className = 'bad';
    }
  }

  $('#check').onclick = check;
  $('#confirm').oninput = sync;

  $('#del').onclick = async () => {
    $('#del').disabled = true;
    try {
      const r = await api('/admin/test-orders/delete', {
        method: 'POST',
        body: JSON.stringify({ before: iso(), confirm: $('#confirm').value.trim() })
      });
      toast(r.message, 'success');
      $('#confirm').value = '';
      await check();
      $('#msg').textContent = r.message;
      $('#msg').className = 'ok';
    } catch (e) {
      $('#msg').textContent = e.message || 'Delete fail hua. Kuch nahi hata.';
      $('#msg').className = 'bad';
    }
  };
})();
