'use strict';

/*
  Product page: "Delivery check" box. Customer types a PIN code and sees
  whether we deliver, whether Cash on Delivery works, and the courier's
  estimated days. No login needed. Uses POST /api/delivery/product-check.
  Never invents a date: if the server gives none, none is shown.
*/

(() => {
  const KEY = 'mcLastPin';
  const style = document.createElement('style');
  style.textContent = `
.mc-pin{margin:16px 0;padding:14px 16px;border:1px solid #eadfce;border-radius:14px;background:#fffaf3}
.mc-pin>b{display:block;font-size:14px;margin-bottom:8px;color:#3b2a1d}
.mc-pin form{display:flex;gap:8px}
.mc-pin input{flex:1;min-width:0;padding:11px 12px;border:1px solid #d9c9b4;border-radius:10px;font-size:15px;letter-spacing:1px;background:#fff}
.mc-pin button{padding:0 18px;border:0;border-radius:10px;background:#8a5a3b;color:#fff;font-weight:700;cursor:pointer}
.mc-pin button[disabled]{opacity:.6}
.mc-pin-res{margin-top:10px;font-size:13.5px;line-height:1.55}
.mc-pin-res .ok{color:#1f7a4a;font-weight:700}
.mc-pin-res .no{color:#b3261e;font-weight:700}
.mc-pin-res .soft{color:#7a6a58}`;
  document.head.appendChild(style);

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function dateText(iso) {
    const d = iso ? new Date(iso) : null;
    return d && !isNaN(d) ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
  }

  function render(data) {
    if (!data.success) return `<span class="soft">${esc(data.message || 'Abhi check nahi ho paya.')}</span>`;
    if (!data.available) return `<span class="no">✖ ${esc(data.message)}</span>`;

    const days = Number(data.estimatedDeliveryDays);
    const date = dateText(data.estimatedDeliveryDate);
    const eta = date ? `Expected by <b>${esc(date)}</b>` : (days > 0 ? `Approx. <b>${days} din</b> me delivery` : '');
    const cod = data.codAvailable === true ? '✔ Cash on Delivery available'
      : data.codAvailable === false ? '✖ Cash on Delivery is PIN par nahi (online payment chalega)' : '';

    return `<span class="ok">✔ Delivery available</span>` +
      (eta ? `<br>${eta}` : '') + (cod ? `<br>${cod}` : '') +
      '<br><span class="soft">Date courier ka andaza hai, pakki guarantee nahi.</span>';
  }

  function mount(root, productId) {
    if (!root || root.querySelector('.mc-pin')) return;

    const box = document.createElement('section');
    box.className = 'mc-pin';
    box.innerHTML = `<b>📍 Delivery check</b>
      <form novalidate><input inputmode="numeric" maxlength="6" autocomplete="postal-code" placeholder="6-digit PIN code" aria-label="PIN code"><button type="submit">Check</button></form>
      <div class="mc-pin-res" aria-live="polite"></div>`;

    const actions = root.querySelector('.actions');
    if (actions && actions.parentElement) actions.parentElement.insertBefore(box, actions);
    else root.appendChild(box);

    const input = box.querySelector('input');
    const out = box.querySelector('.mc-pin-res');
    const btn = box.querySelector('button');

    try { input.value = localStorage.getItem(KEY) || ''; } catch (_) {}

    const run = async () => {
      const pin = input.value.trim();
      if (!/^[1-9][0-9]{5}$/.test(pin)) { out.innerHTML = '<span class="no">6 ankon ka sahi PIN code daalein.</span>'; return; }
      btn.disabled = true;
      out.innerHTML = '<span class="soft">Check ho raha hai…</span>';
      try {
        const res = await fetch(window.MC.API_BASE + '/delivery/product-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pincode: pin, productId })
        });
        const data = await res.json().catch(() => ({}));
        out.innerHTML = render(data);
        try { localStorage.setItem(KEY, pin); } catch (_) {}
      } catch (_) {
        out.innerHTML = '<span class="soft">Internet check karke dobara try karein.</span>';
      }
      btn.disabled = false;
    };

    box.querySelector('form').addEventListener('submit', e => { e.preventDefault(); run(); });
    input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(0, 6); });
  }

  window.MCPinCheck = { mount, render };
})();
