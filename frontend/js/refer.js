/*
  Offers & Refer and Earn page. Everything comes from the server
  (Admin -> Store Settings controls amounts and on/off).
*/
(async () => {
  'use strict';

  const MC = window.MC;
  const root = document.getElementById('referRoot');
  const { api, esc, money, toast } = MC;
  const SITE = 'https://memoracreationscare.in/frontend';

  const copy = async text => {
    try { await navigator.clipboard.writeText(text); toast('Copied!', 'success'); }
    catch { toast('Copy this: ' + text, 'info'); }
  };

  const day = v => v ? esc(new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })) : '';

  const STATUS = {
    JOINED: ['Sign up kiya', '#6b5a4d', '#f3ece4'],
    ORDERED: ['Order kiya, deliver hone ka wait', '#8a5a00', '#fff1cf'],
    DELIVERED: ['Order deliver ho gaya', '#24734c', '#e3f3e9'],
    REWARDED: ['Reward mil gaya', '#24734c', '#d6f0df']
  };

  const couponState = c => c.used ? 'use ho chuka' : c.expired ? 'expire ho gaya' : 'active';
  const copyBtn = c => (c.used || c.expired) ? '' : `<button type="button" class="rf-mini" data-copy="${esc(c.code)}">Copy</button>`;

  const user = await MC.requireLogin();

  if (!user) return;

  let offers;
  let hist = null;

  try {
    offers = await api('/profile/offers');
  } catch (err) {
    root.innerHTML = `<div class="rf-card">Page load nahi ho paya (${esc(err.message || 'server error')}). <button class="rf-btn" onclick="location.reload()">Retry</button></div>`;
    return;
  }

  const { referral, welcome, coupons } = offers;
  const referOn = referral && referral.enabled;

  if (referOn) {
    try { hist = await api('/profile/referrals'); } catch (_) { hist = null; }
  }

  const parts = [];

  /* ---- Refer & Earn hero ---- */
  if (referOn && referral.code) {
    const link = `${SITE}/signup.html?ref=${encodeURIComponent(referral.code)}`;
    const text = `Namaste! Memora Creations se shopping karo, mere code ${referral.code} se sign up karoge to ${money(referral.friendAmount)} off milega: ${link}`;

    parts.push(`
      <section class="rf-card rf-hero">
        <div class="rf-eyebrow">Refer &amp; Earn</div>
        <h2>Friend ko ${esc(money(referral.friendAmount))} off, aapko ${esc(money(referral.rewardAmount))} off</h2>
        <p>Apna code share karo. Friend sign up karte hi coupon pa leta hai, aur uska pehla order deliver hote hi aapko bhi coupon mil jata hai.</p>
        <div class="rf-code"><span>Aapka referral code</span><b>${esc(referral.code)}</b></div>
        <div class="rf-actions">
          <a class="rf-btn rf-wa" target="_blank" rel="noopener noreferrer" href="https://wa.me/?text=${encodeURIComponent(text)}">Share on WhatsApp</a>
          <button type="button" class="rf-btn rf-line" data-copy="${esc(referral.code)}">Copy code</button>
          <button type="button" class="rf-btn rf-line" data-copy="${esc(link)}">Copy link</button>
        </div>
      </section>
      <section class="rf-card">
        <h3>Kaise kaam karta hai</h3>
        <ol class="rf-steps">
          <li><b>1.</b> Apna code ya link friend ko bhejo.</li>
          <li><b>2.</b> Friend us code se sign up kare, usse ${esc(money(referral.friendAmount))} ka coupon mil jata hai.</li>
          <li><b>3.</b> Friend ka pehla order deliver ho, aapko ${esc(money(referral.rewardAmount))} ka coupon apne aap mil jata hai. Coupon ${referral.minOrder ? esc(money(referral.minOrder)) + ' se upar ke order par' : ''} lagta hai, 60 din chalta hai aur ek hi baar use hota hai.</li>
        </ol>
      </section>`);
  } else if (!referOn) {
    parts.push(`<section class="rf-card"><h3>Refer &amp; Earn</h3><p>Refer &amp; Earn abhi chalu nahi hai. Jaldi hi wapas aayega!</p></section>`);
  }

  /* ---- History ---- */
  if (hist) {
    const st = hist.stats || {};
    const by = hist.referredBy;
    const tile = (n, label) => `<div class="rf-tile"><b>${n}</b><span>${label}</span></div>`;

    const rows = (hist.friends || []).map(f => {
      const [label, color, bg] = STATUS[f.status] || STATUS.JOINED;

      return `<div class="rf-row">
        <div class="rf-row-top">
          <div><b>${esc(f.name)}</b> <small>${esc(f.mobile)} &middot; ${day(f.joinedAt)}</small></div>
          <span class="rf-chip" style="color:${color};background:${bg}">${label}</span>
        </div>
        ${f.reward ? `<div class="rf-sub">Aapka reward coupon: <b>${esc(f.reward.code)}</b> <small>(${couponState(f.reward)})</small> ${copyBtn(f.reward)}</div>` : ''}
      </div>`;
    }).join('');

    parts.push(`
      <section class="rf-card">
        <h3>Mere Referrals</h3>
        <div class="rf-tiles">
          ${tile(esc(st.joined || 0), 'Friends joined')}
          ${tile(esc(st.ordered || 0), 'Order kiya')}
          ${tile(esc(st.rewarded || 0), 'Rewards mile')}
          ${tile(esc(money(st.earned || 0)), 'Kul bachat')}
        </div>
        ${by ? `<div class="rf-note">🙋 Aapko <b>${esc(by.name)}</b> ne refer kiya${by.at ? ' (' + day(by.at) + ')' : ''}.
          ${by.gift ? ' Aapka welcome gift coupon: <b>' + esc(by.gift.code) + '</b> <small>(' + couponState(by.gift) + ')</small> ' + copyBtn(by.gift) : ''}</div>` : ''}
        ${rows || '<p class="rf-empty">Abhi tak kisi ne aapke code se sign up nahi kiya. Upar se link share karo!</p>'}
        <p class="rf-fine">Privacy ke liye friend ka naam aur number aadha chhupa rehta hai.</p>
      </section>`);
  }

  /* ---- Offers & coupons ---- */
  const offerRows = [];

  if (welcome && welcome.available) {
    offerRows.push(`<div class="rf-offer">🎁 <b>Pehle order par ${esc(welcome.percent)}% off</b> (max ${esc(money(welcome.maxDiscount))}, ${esc(money(welcome.minOrder))} se upar). Code <b>${esc(welcome.code)}</b>
      <button type="button" class="rf-mini" data-copy="${esc(welcome.code)}">Copy</button></div>`);
  }

  (coupons || []).forEach(c => offerRows.push(`<div class="rf-offer">🎟️ <b>${esc(c.code)}</b> - ${esc(c.description || money(c.value) + ' off')}
    (${esc(money(c.minOrder))} se upar, ${day(c.expiresAt)} tak) <button type="button" class="rf-mini" data-copy="${esc(c.code)}">Copy</button></div>`));

  parts.push(`
    <section class="rf-card">
      <h3>Mere offers &amp; coupons</h3>
      ${offerRows.join('') || '<p class="rf-empty">Abhi koi active offer nahi hai. Naye offers aate hi yahan dikhenge.</p>'}
      <p class="rf-fine">Coupon cart me code daalkar lagta hai.</p>
    </section>`);

  root.innerHTML = parts.join('');
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-copy]');

    if (b) copy(b.dataset.copy);
  });
})();
