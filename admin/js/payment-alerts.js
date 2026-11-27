/*
  Dashboard "Payment safety": orders where money and order do not match
  (paid but cancelled, paid without stock, stuck pending, late payment).
  Quiet green line when all is fine. Never breaks the dashboard.
*/
(async () => {
  const { api, esc } = window.MC || {};
  const anchor = document.getElementById('stats')?.previousElementSibling;

  if (!api || !anchor) return;

  try {
    const d = await api('/admin/payment-alerts');
    const wrap = document.createElement('section');
    const style = document.createElement('style');

    style.textContent = `
      .pa{margin:0 0 22px;border-radius:16px;padding:14px 18px;border:1px solid #e8a29b;background:#fff4f2}
      .pa.ok{border-color:#b9dfc3;background:#f1faf3}
      .pa h2{margin:0 0 8px;font-size:17px}.pa li{margin:6px 0;line-height:1.5}`;
    document.head.appendChild(style);

    if (!d.alerts.length) {
      wrap.className = 'pa ok';
      wrap.innerHTML = '<b>✅ Payment safety:</b> koi atka hua ya mismatch payment nahi mila.';
    } else {
      wrap.className = 'pa';
      wrap.innerHTML = `<h2>🚨 Payment par dhyaan dein (${d.alerts.length})</h2><ul>` +
        d.alerts.map(a => `<li>${esc(a.text)}</li>`).join('') +
        '</ul><small>Order ID admin ke Orders page par search karke dekh sakte ho.</small>';
    }

    anchor.before(wrap);
  } catch (_) { /* staff (no access) or network: stay silent */ }
})();
