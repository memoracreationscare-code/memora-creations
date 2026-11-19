/*
  Profile page: one small card that opens the "Offers & Refer and Earn" page
  (refer.html). Everything is controlled from Admin -> Store Settings.
*/
(() => {

  if (!window.MC || typeof window.MC.api !== 'function') return;

  const { api, esc, money } = window.MC;

  api('/profile/offers').then(data => {
    const { referral, welcome, coupons } = data;
    const hints = [];

    if (referral && referral.enabled) {
      hints.push(`Friend ko ${money(referral.friendAmount)} off, aapko ${money(referral.rewardAmount)} off`);
    }

    if (welcome && welcome.available) hints.push(`Pehle order par ${welcome.percent}% off`);
    if ((coupons || []).length) hints.push(`${coupons.length} personal coupon${coupons.length > 1 ? 's' : ''}`);

    if (!hints.length) return;

    const layout = document.querySelector('.profile-layout');

    if (!layout || !layout.parentNode) return;

    const link = document.createElement('a');

    link.href = '/frontend/refer.html';
    link.style.cssText = 'display:flex;align-items:center;gap:14px;max-width:1100px;margin:18px auto;padding:16px 18px;border-radius:18px;text-decoration:none;color:#3a2618;background:linear-gradient(135deg,#fff8ea,#fdebd0);border:1px solid #e7cfa4;box-shadow:0 6px 20px #6b45201a';
    link.innerHTML = `
      <span style="font-size:30px" aria-hidden="true">🎁</span>
      <span style="flex:1;min-width:0">
        <b style="display:block;font-size:17px">Offers &amp; Refer and Earn</b>
        <small style="color:#7a6048;font-size:13.5px">${esc(hints.join(' · '))}</small>
      </span>
      <span style="font-weight:800;color:#7a4a30;white-space:nowrap">Dekho &rarr;</span>`;

    layout.parentNode.insertBefore(link, layout);
  }).catch(() => { /* optional */ });

})();
