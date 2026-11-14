/*
  Share a product + "order on WhatsApp" (home cards, product list, popup, product page).

  Markup it understands:
    data-share-id="<id>" data-share-name="<name>"  [data-share-image] [data-share-price]
        -> opens a branded share sheet (WhatsApp, Facebook, Telegram, X, Email, copy link, more)
    data-wa-order data-wa-id data-wa-name [data-wa-price]
        -> opens WhatsApp chat with the shop, with the product name, price and link filled in

  Both are switched on/off from the admin panel (Settings -> Product page features):
    shareEnabled, waOrderEnabled, waOrderText.
*/
(() => {
  const API_ROOT = 'https://api.memoracreationscare.in/api';
  const DEFAULT_WA = '918874050204';

  const ICON = {
    share: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
    wa: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M12.04 2a9.9 9.9 0 0 0-8.43 15.1L2 22l5.05-1.32A9.9 9.9 0 1 0 12.04 2zm0 1.8a8.1 8.1 0 1 1-4.2 15.03l-.3-.18-2.99.78.8-2.91-.2-.31A8.1 8.1 0 0 1 12.04 3.8zm-3.1 4.1c-.2 0-.5.07-.77.36-.26.3-1 1-1 2.4s1.03 2.8 1.17 3c.15.2 2 3.2 4.95 4.36 2.45.96 2.95.77 3.48.72.53-.05 1.7-.7 1.94-1.37.24-.68.24-1.26.17-1.38-.07-.12-.27-.2-.56-.34-.3-.15-1.7-.84-1.97-.94-.26-.1-.46-.15-.65.15-.2.29-.75.93-.92 1.12-.17.2-.34.22-.63.07-.3-.14-1.24-.46-2.35-1.45-.87-.77-1.45-1.72-1.62-2.01-.17-.3-.02-.45.13-.6.13-.13.3-.34.44-.51.15-.17.2-.3.3-.49.1-.2.05-.37-.02-.51-.08-.15-.65-1.57-.9-2.15-.23-.56-.47-.48-.65-.49h-.55z"/></svg>',
    fb: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M13.5 22v-8h2.7l.5-3.3h-3.2V8.6c0-.9.4-1.8 1.9-1.8h1.4V4c-.3 0-1.2-.2-2.3-.2-2.4 0-4 1.4-4 4.1v2.8H7.7V14h2.8v8z"/></svg>',
    tg: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M21.4 3.6 2.7 10.8c-.8.3-.8 1.4 0 1.7l4.6 1.4 1.8 5.6c.2.6 1 .8 1.4.3l2.6-2.4 4.6 3.4c.6.4 1.3.1 1.5-.6L22.9 5c.2-.9-.7-1.7-1.5-1.4zM9.4 13.6l8.1-5-6.4 6.4-.3 2.9z"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M17.8 3h3l-6.6 7.5L22 21h-6.1l-4.8-6.2L5.6 21h-3l7.1-8L2 3h6.2l4.3 5.7zm-1.1 16.2h1.7L7.3 4.7H5.5z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    link: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.1 0l-3 3A5 5 0 0 0 11 21.1l1.7-1.7"/></svg>',
    more: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>'
  };

  window.MC_ICONS = Object.assign(window.MC_ICONS || {}, { share: ICON.share, wa: ICON.wa });

  const style = document.createElement('style');

  style.textContent = `
    .mc-share-card{position:absolute;top:62px;right:12px;z-index:4;width:40px;height:40px;padding:0;border-radius:999px;border:1px solid #ead9cf;background:rgba(255,255,255,.96);color:#71412c;font-size:0;line-height:0;cursor:pointer;box-shadow:0 4px 14px #3a1f1226;display:inline-grid;place-items:center;transition:transform .15s,box-shadow .15s,background .15s}
    .mc-share-card::before{content:"";width:19px;height:19px;background:currentColor;-webkit-mask:var(--mc-share-svg) center/contain no-repeat;mask:var(--mc-share-svg) center/contain no-repeat}
    .mc-share-card:hover{transform:translateY(-1px);background:#fff;box-shadow:0 7px 18px #3a1f1233}
    .mc-share-card:focus-visible{outline:3px solid #9b613c;outline-offset:3px}
    :root{--mc-share-svg:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><circle cx='18' cy='5' r='3'/><circle cx='6' cy='12' r='3'/><circle cx='18' cy='19' r='3'/><path d='M8.6 13.5l6.8 4M15.4 6.5l-6.8 4'/></svg>")}

    .mc-share-btn,.mc-wa-order{display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:800;text-decoration:none}
    .mc-share-btn svg,.mc-wa-order svg{width:18px;height:18px;flex:none}
    a.mc-wa-order{display:flex;width:100%;min-height:48px;border-radius:12px;box-sizing:border-box}
    .mc-pop-extra .mc-wa-order{display:inline-flex;width:auto;min-height:42px}
    .mc-wa-order{background:#e9f9ef!important;color:#117a3d!important;border:1.5px solid #bfe8cd!important}
    .mc-wa-order:hover{background:#d9f3e3!important}
    .mc-pop-extra{display:flex;gap:8px;flex-wrap:wrap;margin-top:2px}
    .mc-pop-extra>*{flex:1 1 130px;min-height:42px;border-radius:12px;font-size:14px;font-weight:800;padding:0 10px;cursor:pointer;white-space:nowrap}
    .mc-pop-extra .mc-pop-share{border:1.5px solid #e4d2c6;background:#fff;color:#71412c;display:inline-flex;align-items:center;justify-content:center;gap:8px}
    .mc-pop-extra .mc-wa-order{border-radius:12px}
    .mc-pop-detail{display:block;margin-top:4px;text-align:center;color:#8a5a3b;font-weight:800;font-size:14px;text-decoration:none}
    .mc-pop-detail:hover{text-decoration:underline}

    .mc-share-menu{grid-template-columns:minmax(0,1fr);position:fixed;inset:0;background:#2a1d1599;-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);z-index:99999;display:grid;place-items:end center;padding:0;animation:mcShareFade .18s ease-out}
    .mc-share-sheet{min-width:0;box-sizing:border-box;background:#fff;border-radius:22px 22px 0 0;width:min(480px,100%);padding:10px 18px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -12px 50px #0004;font-family:inherit;animation:mcShareUp .22s ease-out}
    @media(min-width:640px){.mc-share-menu{place-items:center;padding:20px}.mc-share-sheet{border-radius:22px;padding:14px 20px 20px}}
    .mc-share-grab{width:44px;height:4px;border-radius:4px;background:#e2d6cc;margin:2px auto 12px}
    @media(min-width:640px){.mc-share-grab{display:none}}
    .mc-share-head{display:flex;gap:12px;align-items:center;padding-bottom:14px;border-bottom:1px solid #f0e6de}
    .mc-share-head img{width:56px;height:56px;border-radius:12px;object-fit:cover;background:#f5f0eb;flex:none}
    .mc-share-head h3{margin:0;font-size:16px;line-height:1.3;color:#241c16;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .mc-share-head p{margin:3px 0 0;color:#8a5a3b;font-weight:800;font-size:14px}
    .mc-share-close{margin-left:auto;flex:none;width:34px;height:34px;border-radius:50%;border:0;background:#f4ece5;color:#4a3425;font-size:20px;line-height:1;cursor:pointer}
    .mc-share-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px 6px;padding:16px 0 6px}
    .mc-share-opt{display:flex;flex-direction:column;align-items:center;gap:7px;border:0;background:none;padding:0;cursor:pointer;color:#3a2a20;font-size:12px;font-weight:600;line-height:1.2;text-decoration:none;font-family:inherit}
    .mc-share-opt i{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;font-size:25px;color:#fff;font-style:normal;transition:transform .15s}
    .mc-share-opt:hover i{transform:scale(1.07)}
    .mc-share-opt:focus-visible{outline:3px solid #9b613c;outline-offset:4px;border-radius:12px}
    .mc-share-link{display:flex;gap:8px;align-items:center;margin-top:12px;padding:8px 8px 8px 14px;border:1px solid #ead9cf;border-radius:12px;background:#faf6f2}
    .mc-share-link span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#6b5d52;font-size:13px}
    .mc-share-link button{border:0;border-radius:9px;background:#8a5a3b;color:#fff;font-weight:800;font-size:13px;padding:9px 14px;cursor:pointer;font-family:inherit}
    @keyframes mcShareUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
    @keyframes mcShareFade{from{opacity:0}to{opacity:1}}
    @media(prefers-reduced-motion:reduce){.mc-share-menu,.mc-share-sheet{animation:none}}`;
  document.head.appendChild(style);

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t) => (window.MC && window.MC.toast ? window.MC.toast(m, t) : alert(m));

  /* ---------- admin switches (public settings, fetched once) ---------- */

  let settings = { shareEnabled: true, waOrderEnabled: true, waOrderText: '', whatsapp: DEFAULT_WA };

  const ready = fetch(API_ROOT + '/settings')
    .then(r => r.json())
    .then(data => {
      const s = (data && (data.settings || data.data || data)) || {};

      settings = {
        shareEnabled: s.shareEnabled !== false,
        waOrderEnabled: s.waOrderEnabled !== false,
        waOrderText: String(s.waOrderText || ''),
        whatsapp: String(s.whatsapp || DEFAULT_WA).replace(/\D/g, '') || DEFAULT_WA
      };

      const off = [];

      if (!settings.shareEnabled) off.push('.mc-share-card,[data-share-id],.mc-pop-share');
      if (!settings.waOrderEnabled) off.push('[data-wa-order]');

      if (off.length) {
        const hide = document.createElement('style');

        hide.textContent = off.join(',') + '{display:none!important}';
        document.head.appendChild(hide);
      }
    })
    .catch(() => {});

  const pageUrl = id => location.origin + '/frontend/product.html?id=' + encodeURIComponent(id);

  /* ---------- share sheet ---------- */

  async function shareProduct(id, name, image, price) {
    await ready;

    if (!settings.shareEnabled) return;

    const url = API_ROOT + '/products/' + encodeURIComponent(id) + '/share';
    const text = `${name} - Memora Creations`;
    const enc = encodeURIComponent;

    const options = [
      { key: 'wa', label: 'WhatsApp', icon: ICON.wa, bg: '#25d366', href: 'https://wa.me/?text=' + enc(text + '\n' + url) },
      { key: 'fb', label: 'Facebook', icon: ICON.fb, bg: '#1877f2', href: 'https://www.facebook.com/sharer/sharer.php?u=' + enc(url) },
      { key: 'tg', label: 'Telegram', icon: ICON.tg, bg: '#229ed9', href: 'https://t.me/share/url?url=' + enc(url) + '&text=' + enc(text) },
      { key: 'x', label: 'X', icon: ICON.x, bg: '#111', href: 'https://twitter.com/intent/tweet?text=' + enc(text) + '&url=' + enc(url) },
      { key: 'mail', label: 'Email', icon: ICON.mail, bg: '#8a5a3b', href: 'mailto:?subject=' + enc(text) + '&body=' + enc(text + '\n' + url) }
    ];

    const wrap = document.createElement('div');

    wrap.className = 'mc-share-menu';
    wrap.innerHTML = `<div class="mc-share-sheet" role="dialog" aria-modal="true" aria-label="Share">
      <div class="mc-share-grab"></div>
      <div class="mc-share-head">
        ${image ? `<img src="${esc(image)}" alt="" loading="lazy">` : ''}
        <div><h3>${esc(name)}</h3>${price ? `<p>${esc(price)}</p>` : ''}</div>
        <button type="button" class="mc-share-close" data-close aria-label="Close">×</button>
      </div>
      <div class="mc-share-grid">
        ${options.map(o => `<a class="mc-share-opt" target="_blank" rel="noopener" href="${esc(o.href)}" data-close><i style="background:${o.bg}">${o.icon}</i>${o.label}</a>`).join('')}
        <button type="button" class="mc-share-opt" data-copy><i style="background:#6b5d52">${ICON.link}</i>Copy link</button>
        ${navigator.share ? `<button type="button" class="mc-share-opt" data-native><i style="background:#b07a52">${ICON.more}</i>More</button>` : ''}
      </div>
      <div class="mc-share-link"><span>${esc(url)}</span><button type="button" data-copy>Copy</button></div>
    </div>`;

    document.body.appendChild(wrap);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const close = () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      wrap.remove();
    };
    const onKey = e => { if (e.key === 'Escape') close(); };

    document.addEventListener('keydown', onKey);
    wrap.querySelector('[data-close]')?.focus();

    wrap.addEventListener('click', async event => {
      if (event.target === wrap || event.target.closest('button[data-close]')) return close();

      if (event.target.closest('a[data-close]')) return setTimeout(close, 50);

      if (event.target.closest('[data-copy]')) {
        try {
          await navigator.clipboard.writeText(url);
          toast('Link copy ho gaya.', 'success');
        } catch (_) {
          toast(url, 'message');
        }
        return close();
      }

      if (event.target.closest('[data-native]')) {
        try { await navigator.share({ title: text, text, url }); } catch (_) { /* cancelled */ }
        close();
      }
    });
  }

  /* ---------- order on WhatsApp ---------- */

  async function orderOnWhatsApp(id, name, price) {
    await ready;

    if (!settings.waOrderEnabled) return;

    const intro = settings.waOrderText || 'Namaste Memora Creations, mujhe ye product order karna hai:';
    const message = `${intro}\n\n${name}${price ? '\nPrice: ' + price : ''}\n${pageUrl(id)}`;

    window.open('https://wa.me/' + settings.whatsapp + '?text=' + encodeURIComponent(message), '_blank', 'noopener');
  }

  window.mcShareProduct = shareProduct;
  window.mcOrderOnWhatsApp = orderOnWhatsApp;

  // capture phase: runs before the card's own "open product" click handlers
  document.addEventListener('click', event => {
    const wa = event.target.closest('[data-wa-order]');

    if (wa) {
      event.preventDefault();
      event.stopPropagation();
      orderOnWhatsApp(wa.dataset.waId, wa.dataset.waName || 'Product', wa.dataset.waPrice || '');
      return;
    }

    const button = event.target.closest('[data-share-id]');

    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    shareProduct(
      button.dataset.shareId,
      button.dataset.shareName || 'Memora Creations',
      button.dataset.shareImage || '',
      button.dataset.sharePrice || ''
    );
  }, true);
})();
