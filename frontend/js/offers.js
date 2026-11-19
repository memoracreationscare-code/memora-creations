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


  const STATUS = {
    JOINED: ['Sign up kiya', '#6b5a4d', '#f3ece4'],
    ORDERED: ['Order kiya, deliver hone ka wait', '#8a5a00', '#fff1cf'],
    DELIVERED: ['Order deliver ho gaya', '#24734c', '#e3f3e9'],
    REWARDED: ['Reward mil gaya', '#24734c', '#d6f0df']
  };

  const day = v => v ? esc(new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })) : '';

  const couponLine = c => c
    ? `<b>${esc(c.code)}</b> <small>(${c.used ? 'use ho chuka' : c.expired ? 'expire ho gaya' : 'active'})</small>
       ${c.used || c.expired ? '' : `<button type="button" data-copy="${esc(c.code)}">Copy</button>`}`
    : '';

  function loadHistory(card) {
    api('/profile/referrals').then(d => {
      const st = d.stats || {};
      const friends = d.friends || [];
      const by = d.referredBy;

      const tile = (n, label) => `<div style="flex:1;min-width:110px;background:#fff;border:1px solid #ecdcc8;border-radius:12px;padding:10px 12px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:#7a4a30">${n}</div><div style="font-size:12px;color:#7a6a5d">${label}</div></div>`;

      const rows = friends.map(f => {
        const [label, color, bg] = STATUS[f.status] || STATUS.JOINED;

        return `<div style="padding:10px 0;border-top:1px solid #f0e4d4">
          <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center">
            <div><b>${esc(f.name)}</b> <small style="color:#8a7b6e">${esc(f.mobile)} &middot; ${day(f.joinedAt)}</small></div>
            <span style="font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;color:${color};background:${bg}">${label}</span>
          </div>
          ${f.reward ? `<div style="margin-top:4px;font-size:13px">Aapka reward coupon: ${couponLine(f.reward)}</div>` : ''}
        </div>`;
      }).join('');

      const box = document.createElement('div');

      box.style.cssText = 'margin-top:16px';
      box.innerHTML = `
        <h3 style="margin:0 0 8px;font-size:17px">Mere Referrals</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${tile(esc(st.joined || 0), 'Friends joined')}
          ${tile(esc(st.ordered || 0), 'Order kiya')}
          ${tile(esc(st.rewarded || 0), 'Rewards mile')}
          ${tile(esc(money(st.earned || 0)), 'Kul bachat')}
        </div>
        ${by ? `<div class="mc-offer">🙋 Aapko <b>${esc(by.name)}</b> ne refer kiya${by.at ? ' (' + day(by.at) + ')' : ''}.
          ${by.gift ? 'Aapka welcome gift coupon: ' + couponLine(by.gift) : ''}</div>` : ''}
        <div style="margin-top:10px">${rows || '<div style="color:#8a7b6e;font-size:14px">Abhi tak kisi ne aapke code se sign up nahi kiya. Upar se link share karo!</div>'}</div>
        <div style="margin-top:8px;font-size:12px;color:#8a7b6e">Friend ka pehla order deliver hote hi aapko reward coupon apne aap mil jata hai. Privacy ke liye friend ka naam aur number aadha chhupa rehta hai.</div>`;

      card.appendChild(box);
    }).catch(() => { /* history is optional */ });
  }

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

    if (referral && referral.enabled) loadHistory(card);
  }).catch(err => {
    // Do not stay silent: show why the Refer & Earn card is missing.
    const layout = document.querySelector('.profile-layout');
    if (!layout || !layout.parentNode) return;
    const note = document.createElement('section');
    note.className = 'profile-card';
    note.style.cssText = 'max-width:1100px;margin:18px auto;padding:14px 18px;font-size:14px';
    note.innerHTML = '<b>Refer &amp; Earn</b> abhi load nahi ho paya (' + esc((err && err.message) || 'server error') +
      '). <button type="button" id="mcOffersRetry" style="margin-left:6px;padding:4px 12px;border-radius:8px;border:1px solid #b98a2c;background:#fff;font-weight:700;cursor:pointer">Retry</button>';
    note.querySelector('#mcOffersRetry').addEventListener('click', () => location.reload());
    layout.parentNode.insertBefore(note, layout);
  });

})();
