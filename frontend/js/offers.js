/*
  Profile page: "Refer & Earn" and the customer's personal coupons.
  Everything comes from Admin -> Store Settings; if it is switched off nothing shows.
*/
(() => {

  if (!window.MC || typeof window.MC.api !== 'function') return;

  const { api, esc, money, toast } = window.MC;
  const SITE = 'https://memoracreationscare.in/frontend';

  const copy = async text => {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied!', 'success');
    } catch {
      toast('Copy this: ' + text, 'info');
    }
  };

  api('/profile/offers').then(data => {
    const { referral, welcome, coupons } = data;
    const rows = [];

    if (welcome && welcome.available) {
      rows.push(`
        <div class="mc-offer">
          🎁 <b>${esc(welcome.percent)}% off your first order</b>
          (up to ${esc(money(welcome.maxDiscount))}, orders above ${esc(money(welcome.minOrder))}).
          Use code <b>${esc(welcome.code)}</b> in your cart.
          <button type="button" data-copy="${esc(welcome.code)}">Copy</button>
        </div>`);
    }

    (coupons || []).forEach(c => rows.push(`
      <div class="mc-offer">
        🎟️ <b>${esc(c.code)}</b> - ${esc(c.description || money(c.value) + ' off')}
        (orders above ${esc(money(c.minOrder))}, till ${esc(new Date(c.expiresAt).toLocaleDateString('en-IN'))})
        <button type="button" data-copy="${esc(c.code)}">Copy</button>
      </div>`));

    let refer = '';

    if (referral && referral.enabled && referral.code) {
      const link = `${SITE}/signup.html?ref=${encodeURIComponent(referral.code)}`;
      const text = `Namaste! Memora Creations se shopping karo, mere code ${referral.code} se sign up karoge to ${money(referral.friendAmount)} off milega: ${link}`;

      refer = `
        <div class="mc-offer">
          🤝 <b>Refer & Earn:</b> share your code <b>${esc(referral.code)}</b>. Your friend gets
          ${esc(money(referral.friendAmount))} off, and you get ${esc(money(referral.rewardAmount))} off
          when their first order is delivered.
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
            <a class="btn" target="_blank" rel="noopener noreferrer"
               href="https://wa.me/?text=${encodeURIComponent(text)}">Share on WhatsApp</a>
            <button type="button" data-copy="${esc(link)}">Copy link</button>
          </div>
        </div>`;
    }

    if (!rows.length && !refer) return;

    const card = document.createElement('section');

    card.className = 'profile-card';
    card.style.cssText = 'max-width:1100px;margin:18px auto;padding:18px';
    card.innerHTML = `
      <style>
        .mc-offer{padding:12px 14px;margin-top:10px;border-radius:12px;background:#fff8ea;border:1px dashed #b98a2c;font-size:14.5px;line-height:1.5}
        .mc-offer button{margin-left:6px;padding:4px 12px;border-radius:8px;border:1px solid #b98a2c;background:#fff;color:#5b3a24;font-weight:700;cursor:pointer}
        .mc-offer .btn{display:inline-block;padding:8px 14px;border-radius:10px;background:#25d366;color:#fff;font-weight:800;text-decoration:none}
      </style>
      <h2 style="margin:0">Offers &amp; Refer and Earn</h2>
      ${rows.join('')}${refer}`;

    card.addEventListener('click', e => {
      const b = e.target.closest('[data-copy]');

      if (b) copy(b.dataset.copy);
    });

    const layout = document.querySelector('.profile-layout');

    if (layout && layout.parentNode) layout.parentNode.insertBefore(card, layout);
  }).catch(() => { /* offers are optional */ });

})();
