'use strict';

(() => {
  const API = 'https://memora-creations.onrender.com/api';
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = d => {
    const x = d ? new Date(d) : null;
    return x && !isNaN(x) ? x.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
  };
  const fmtDay = d => {
    const x = d ? new Date(d) : null;
    return x && !isNaN(x) ? x.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  };

  function render(d) {
    const bad = d.orderStatus === 'Cancelled';
    const steps = (d.history || []).map((h, i, a) =>
      `<li class="${bad && i === a.length - 1 ? '' : 'done'}"><i></i><b>${esc(h.status)}</b><small>${esc(fmt(h.at))}</small></li>`).join('');

    const s = d.shipment;
    const ship = s ? `<div class="trk-ship">
      🚚 <b>${esc(s.courierName || 'Courier')}</b><br>
      AWB: <b>${esc(s.awbCode)}</b>${s.status ? `<br>Status: ${esc(String(s.status).replace(/_/g, ' '))}` : ''}
      ${s.estimatedDeliveryDate && !s.deliveredAt ? `<br>Expected: <b>${esc(fmtDay(s.estimatedDeliveryDate))}</b> <small>(andaza)</small>` : ''}
      ${s.trackingUrl ? `<br><a href="${esc(s.trackingUrl)}" target="_blank" rel="noopener noreferrer">Courier site par live tracking →</a>` : ''}
    </div>` : '<div class="trk-ship">Courier abhi assign nahi hua. Shipment hote hi yahan tracking dikhegi.</div>';

    const items = (d.items || []).map(i => `${esc(i.name)} × ${esc(i.quantity)}`).join(', ');

    return `<div><span class="trk-badge ${bad ? 'bad' : ''}">${esc(d.orderStatus)}</span>
      <b style="margin-left:8px">${esc(d.orderId)}</b></div>
      ${items ? `<p class="trk-items">${items}</p>` : ''}
      <ul class="trk-steps">${steps}</ul>${ship}`;
  }

  const params = new URLSearchParams(location.search);
  if (params.get('id')) $('trkId').value = params.get('id');

  $('trkMobile').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); });

  $('trkForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    $('trkErr').textContent = '';
    $('trkRes').innerHTML = '';
    btn.disabled = true;
    btn.textContent = 'Dhoondh rahe hain…';
    try {
      const res = await fetch(API + '/track-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: $('trkId').value.trim(), mobile: $('trkMobile').value })
      });
      const data = await res.json().catch(() => ({}));
      if (data.success) $('trkRes').innerHTML = render(data);
      else $('trkErr').textContent = data.message || 'Abhi tracking available nahi hai.';
    } catch (_) {
      $('trkErr').textContent = 'Internet check karke dobara try karein.';
    }
    btn.disabled = false;
    btn.textContent = 'Track Order';
  });
})();
