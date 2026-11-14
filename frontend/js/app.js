
/*
=========================================
 MEMORA CREATIONS
 COMMON FRONTEND APP

 Login, Navigation, Cart, Search,
 Wishlist and Account Functions

 FIX:
 No false logout on slow Render backend.
=========================================
*/

const API =
  'https://api.memoracreationscare.in/api';

const BASE =
  '';

const $ = (selector, root = document) =>
  root.querySelector(selector);

const $$ = (selector, root = document) =>
  [...root.querySelectorAll(selector)];


/* =====================================
   API ERROR
===================================== */

class ApiError extends Error {
  constructor(
    message,
    {
      status = 0,
      code = 'UNKNOWN_ERROR'
    } = {}
  ) {
    super(message);

    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}


/* =====================================
   API REQUEST
===================================== */

async function api(path, options = {}) {
  if (
    typeof navigator !== 'undefined' &&
    navigator.onLine === false
  ) {
    throw new ApiError(
      'Internet connection check karein.',
      { code: 'OFFLINE' }
    );
  }

  let response;

  try {
    response = await fetch(API + path, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    });
  } catch (error) {
    console.error('API network error:', error);

    throw new ApiError(
      'Server se connection nahi ho pa raha hai. Internet check karke dobara try karein.',
      {
        code:
          error?.name === 'AbortError'
            ? 'REQUEST_ABORTED'
            : 'NETWORK_ERROR'
      }
    );
  }

  let data = {};

  try {
    const text = await response.text();

    if (text) {
      try {
        data = JSON.parse(text);
      } catch (_) {
        data = {};
      }
    }
  } catch (_) {
    data = {};
  }

  if (!response.ok) {
    const errors = {
      400: 'Request sahi nahi hai.',
      401: 'Session expire ho gaya hai. Please login again.',
      403: 'Aapko is action ki permission nahi hai.',
      404: 'Requested information nahi mili.',
      409: 'Request conflict ho raha hai.',
      429: 'Bahut zyada requests ho gayi hain.'
    };

    const fallback =
      errors[response.status] ||
      (
        response.status >= 500
          ? 'Server me temporary problem hai.'
          : 'Something went wrong. Please try again.'
      );

    throw new ApiError(
      data.message || fallback,
      {
        status: response.status,
        code:
          response.status === 401
            ? 'UNAUTHORIZED'
            : 'HTTP_ERROR'
      }
    );
  }

  return data;
}


/* =====================================
   MONEY FORMAT
===================================== */

function money(value) {
  return `₹${Number(value || 0).toLocaleString(
    'en-IN',
    { maximumFractionDigits: 2 }
  )}`;
}


/* =====================================
   HTML ESCAPE
===================================== */

function esc(value) {
  return String(value ?? '').replace(
    /[&<>'"]/g,
    character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[character])
  );
}


/* =====================================
   CUSTOMER UI: toast, cart popup, gallery
===================================== */

(function injectUiStyles() {
  if (document.getElementById('mc-ui-style')) return;
  const css = `
.mc-toasts{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:100000;display:flex;flex-direction:column;gap:10px;width:min(420px,calc(100vw - 24px));pointer-events:none}
.mc-toast{pointer-events:auto;display:flex;align-items:flex-start;gap:12px;padding:13px 14px;background:#fff;color:#241c16;border-radius:14px;border:1px solid #eee3d6;border-left:5px solid #8a6d4b;box-shadow:0 14px 40px rgba(40,25,10,.22);font:600 14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;animation:mcIn .28s cubic-bezier(.2,.9,.3,1.2)}
.mc-toast.out{animation:mcOut .2s ease forwards}
.mc-toast-ico{flex:none;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:15px;background:#8a6d4b}
.mc-toast.success{border-left-color:#2f8f5b}.mc-toast.success .mc-toast-ico{background:#2f8f5b}
.mc-toast.error{border-left-color:#d64541}.mc-toast.error .mc-toast-ico{background:#d64541}
.mc-toast-msg{flex:1;padding-top:3px;word-break:break-word}
.mc-toast-x{flex:none;border:0;background:transparent;color:#8b7f73;font-size:20px;line-height:1;cursor:pointer;padding:2px 4px}
@keyframes mcIn{from{opacity:0;transform:translateY(-14px) scale(.96)}to{opacity:1;transform:none}}
@keyframes mcOut{to{opacity:0;transform:translateY(-10px)}}

.mc-sheet-ov{position:fixed;inset:0;z-index:99990;background:rgba(25,18,12,.55);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:16px;animation:mcFade .2s ease}
.mc-sheet{width:min(400px,100%);background:#fff;border-radius:22px;padding:26px 22px 20px;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,.3);animation:mcPop .3s cubic-bezier(.2,.9,.3,1.25)}
.mc-sheet-check{width:64px;height:64px;margin:0 auto 14px;border-radius:50%;background:#e8f6ee;display:grid;place-items:center}
.mc-sheet-check svg{width:34px;height:34px;stroke:#2f8f5b;stroke-width:3;fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:30;stroke-dashoffset:30;animation:mcDraw .5s .15s ease forwards}
.mc-sheet h2{margin:0 0 6px;font-size:21px}
.mc-sheet p{margin:0;color:#7a6f63;font-size:14px}
.mc-sheet-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:20px}
.mc-sheet-actions .btn{width:100%;padding:13px 10px;text-align:center;justify-content:center}
@keyframes mcFade{from{opacity:0}to{opacity:1}}
@keyframes mcPop{from{opacity:0;transform:translateY(20px) scale(.94)}to{opacity:1;transform:none}}
@keyframes mcDraw{to{stroke-dashoffset:0}}
@media(max-width:600px){.mc-sheet-ov{align-items:flex-end;padding:0}.mc-sheet{border-radius:24px 24px 0 0;width:100%;padding-bottom:26px;animation:mcUp .3s ease}@keyframes mcUp{from{transform:translateY(100%)}to{transform:none}}}

.mc-rate{display:inline-flex;align-items:center;gap:5px;font:700 12.5px/1 system-ui,sans-serif;color:#3b2a1d;margin:4px 0}
.mc-rate-stars{position:relative;display:inline-block;font-size:14px;letter-spacing:1px;color:#e2d6c6;line-height:1}
.mc-rate-stars::before{content:"★★★★★"}
.mc-rate-stars i{position:absolute;left:0;top:0;overflow:hidden;white-space:nowrap;color:#f0a020}
.mc-rate-stars i::before{content:"★★★★★"}
.mc-rate small{font-weight:600;color:#8a7a68;font-size:12px}
.mc-gal{position:relative;width:100%;user-select:none}
.mc-gal-track{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch;border-radius:16px;background:#f5f0eb;scroll-behavior:smooth}
.mc-gal-track::-webkit-scrollbar{display:none}
.mc-gal-slide{flex:0 0 100%;scroll-snap-align:center;display:flex;align-items:center;justify-content:center;aspect-ratio:1/1}
.mc-gal-slide img{width:100%;height:100%;object-fit:contain;display:block;-webkit-user-drag:none}
.mc-gal-nav{position:absolute;top:50%;transform:translateY(-50%);width:38px;height:38px;border-radius:50%;border:0;background:rgba(255,255,255,.92);box-shadow:0 4px 14px rgba(0,0,0,.2);font-size:22px;line-height:1;cursor:pointer;color:#241c16;z-index:2}
.mc-gal-nav.prev{left:8px}.mc-gal-nav.next{right:8px}
.mc-gal-nav[disabled]{opacity:0;pointer-events:none}
.mc-gal-count{position:absolute;right:10px;top:10px;background:rgba(30,22,16,.7);color:#fff;font-size:12px;font-weight:700;padding:3px 9px;border-radius:999px;z-index:2}
.mc-gal-dots{display:flex;justify-content:center;gap:6px;margin-top:10px}
.mc-gal-dots i{width:7px;height:7px;border-radius:50%;background:#d8cdbf;transition:.2s}
.mc-gal-dots i.on{background:#8a6d4b;width:20px;border-radius:99px}
.mc-gal-thumbs{display:flex;gap:8px;margin-top:10px;overflow-x:auto;scrollbar-width:thin}
.mc-gal-thumbs img{flex:none;width:62px;height:62px;object-fit: contain;border-radius:10px;border:2px solid transparent;cursor:pointer;opacity:.7}
.mc-gal-thumbs img.on{border-color:#8a6d4b;opacity:1}
@media(max-width:600px){.mc-gal-nav{display:none}.mc-gal-thumbs{display:none}}

html body #product .gallery{display:block!important}

/* ---------- Product page actions ---------- */
html body #product .actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
html body #product .actions>.btn{min-height:50px;border-radius:12px;font-weight:800}
html body #product .actions>#addBtn{grid-column:1/-1}
html body #product .actions>#buyBtn{grid-column:1/-1}
html body #product .mc-sub-actions{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:10px}
html body #product .mc-sub-actions>*{min-height:44px;border-radius:12px;font-size:14px;margin:0;width:100%}
html body #product .field .mc-qty{display:inline-grid}

/* ---------- Product quick-view popup ---------- */
.product-popup-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;background:rgba(25,18,12,.6);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);animation:mcFade .2s ease}
.product-popup{position:relative;width:min(900px,100%);max-height:90vh;max-height:90dvh;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 30px 90px rgba(0,0,0,.35);animation:mcPop .3s cubic-bezier(.2,.9,.3,1.2)}
.product-popup-close{position:absolute;top:12px;right:12px;z-index:5;width:38px;height:38px;border:0;border-radius:50%;background:rgba(255,255,255,.95);color:#241c16;font-size:24px;line-height:1;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.2);display:grid;place-items:center;padding:0;transition:transform .15s}
.product-popup-close:hover{transform:scale(1.08)}
.product-popup-imagebox{background:#f5f0eb;min-width:0;display:block;padding:0;margin:0}
.product-popup-imagebox .mc-gal{height:100%}
.product-popup-imagebox .mc-gal-track{border-radius:0;height:100%}
.product-popup-imagebox .mc-gal-slide{aspect-ratio:1/1;height:100%}
.product-popup-imagebox .mc-gal-slide img{object-fit:contain}
.product-popup-imagebox .mc-gal-dots{position:absolute;left:0;right:0;bottom:10px;margin:0}
.product-popup-imagebox .mc-gal-dots i{background:rgba(255,255,255,.7)}
.product-popup-imagebox .mc-gal-dots i.on{background:#fff}
.product-popup-info{display:flex;flex-direction:column;gap:10px;padding:26px 26px 22px;overflow-y:auto;min-width:0}
.product-popup-info .pill{align-self:flex-start;font-size:11.5px;letter-spacing:.6px;text-transform:uppercase}
.product-popup-info h2{margin:0;font-size:clamp(20px,2.6vw,27px);line-height:1.25;color:#241c16}
.product-popup-price{display:flex;align-items:baseline;flex-wrap:wrap;gap:10px;font-size:26px;font-weight:900;color:#241c16;margin:0}
.product-popup-price .old{font-size:15px;font-weight:600;color:#9a8d80;text-decoration:line-through}
.product-popup-price .mc-off{font-size:12px;font-weight:800;color:#1f7a4a;background:#e8f6ee;padding:3px 8px;border-radius:999px;align-self:center}
.product-popup-info>p.muted{margin:0;font-size:14px;line-height:1.6;color:#6b5d50;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;line-clamp:3;overflow:hidden}
.product-popup-info>p.mc-stock{margin:0;font-size:13px;font-weight:700;color:#1f7a4a;display:flex;align-items:center;gap:6px}
.product-popup-info>p.mc-stock.out{color:#b3261e}
.product-popup-info>p.mc-stock::before{content:"";width:8px;height:8px;border-radius:50%;background:currentColor}
.mc-buy{display:grid;gap:10px;margin-top:auto;padding-top:6px}
.mc-buy-row{display:grid;grid-template-columns:auto 1fr;gap:10px}
.mc-buy .btn{width:100%;min-height:48px;padding:12px 14px;border-radius:12px;font-size:15px;font-weight:800;white-space:normal;text-align:center;justify-content:center}
.mc-qty{display:inline-grid;grid-template-columns:42px 52px 42px;align-items:stretch;border:1.5px solid #e2d5c6;border-radius:12px;overflow:hidden;background:#fff;min-height:48px}
.mc-qty button{border:0;background:#faf6f0;font-size:20px;font-weight:700;color:#241c16;cursor:pointer}
.mc-qty button:active{background:#f0e6d6}
.mc-qty input{width:100%;min-height:0!important;height:auto!important;border:0!important;border-radius:0!important;text-align:center;font-size:16px!important;font-weight:800;padding:0!important;background:#fff!important;-moz-appearance:textfield;appearance:textfield}
.mc-qty input::-webkit-outer-spin-button,.mc-qty input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
@media(max-width:760px){
.product-popup-overlay{align-items:flex-end;padding:0}
.product-popup{grid-template-columns:minmax(0,1fr);grid-template-rows:auto minmax(0,1fr);width:100%;max-height:92vh;max-height:92dvh;border-radius:24px 24px 0 0;animation:mcUp .3s ease}
.product-popup-imagebox .mc-gal-track,.product-popup-imagebox .mc-gal{height:auto}
.product-popup-imagebox .mc-gal-slide{aspect-ratio:1/1;height:auto;max-height:44vh;max-height:44dvh;width:100%}
.product-popup-imagebox .mc-gal-slide img{object-fit:contain}
.product-popup-info{padding:16px 18px 18px;gap:8px;overflow-y:auto}
.product-popup-info h2{font-size:19px}
.product-popup-price{font-size:23px}
.mc-buy{position:sticky;bottom:-18px;background:#fff;margin:0 -18px -18px;padding:12px 18px 18px;border-top:1px solid #f0e8dc}
}
`;
  const el = document.createElement('style');
  el.id = 'mc-ui-style';
  el.textContent = css;
  document.head.appendChild(el);
})();

function toast(message, type = 'message') {
  // Admin pages define their own floating toast (admin/js/nav.js).
  if (typeof window.mcToast === 'function') return window.mcToast(message, type);

  let stack = document.querySelector('.mc-toasts');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'mc-toasts';
    stack.setAttribute('role', 'status');
    stack.setAttribute('aria-live', 'polite');
    document.body.appendChild(stack);
  }
  while (stack.children.length >= 3) stack.firstChild.remove();

  const kind = type === 'success' || type === 'error' ? type : 'message';
  const icon = kind === 'success' ? '✓' : kind === 'error' ? '!' : 'i';
  const el = document.createElement('div');
  el.className = `mc-toast ${kind}`;
  const ico = document.createElement('span');
  ico.className = 'mc-toast-ico';
  ico.textContent = icon;
  const msg = document.createElement('span');
  msg.className = 'mc-toast-msg';
  msg.textContent = message;
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'mc-toast-x';
  x.setAttribute('aria-label', 'Close');
  x.textContent = '×';
  el.append(ico, msg, x);
  stack.appendChild(el);

  const close = () => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 200);
  };
  x.addEventListener('click', close);
  setTimeout(close, kind === 'error' ? 5000 : 3200);
}


/* =====================================
   ADD TO CART SUCCESS POPUP
===================================== */

function showCartPopup() {
  document.querySelector('#cartSuccessPopup')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'cartSuccessPopup';
  overlay.className = 'mc-sheet-ov';
  overlay.innerHTML = `
    <div class="mc-sheet" role="dialog" aria-modal="true" aria-label="Added to cart">
      <div class="mc-sheet-check">
        <svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
      </div>
      <h2>Cart me add ho gaya!</h2>
      <p>Aapka product cart me safe hai.</p>
      <div class="mc-sheet-actions">
        <button class="btn secondary cart-popup-close" type="button">Shopping jaari rakho</button>
        <a class="btn" href="${BASE}/frontend/cart.html">Cart dekho</a>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = event => { if (event.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  overlay.querySelector('.cart-popup-close')?.addEventListener('click', close);
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  overlay.querySelector('a.btn')?.focus();
}


/* =====================================
   SWIPEABLE PHOTO GALLERY
   MC.galleryHtml(images, alt, {thumbs}) + MC.initGallery(root)
===================================== */

/* Small "★★★★☆ 4.5 (12)" line. Empty until the product has an approved review. */
function ratingHtml(product) {
  const count = Number(product && product.ratingCount) || 0;
  const avg = Number(product && product.ratingAverage) || 0;
  if (count < 1 || avg <= 0) return '';
  const pct = Math.max(0, Math.min(100, (avg / 5) * 100));
  return `<span class="mc-rate" title="${avg.toFixed(1)} out of 5"><span class="mc-rate-stars" aria-hidden="true"><i style="width:${pct}%"></i></span>${avg.toFixed(1)} <small>(${count})</small></span>`;
}

/* [ - 1 + ] quantity stepper. Keeps a normal <input type=number> inside so existing code can read it. */
function qtyHtml(id, cls, max, disabled) {
  return `<div class="mc-qty"><button type="button" data-qty="-1" aria-label="Kam karo"${disabled ? ' disabled' : ''}>−</button>` +
    `<input id="${id}" class="input ${cls}" type="number" inputmode="numeric" min="1" max="${Math.max(1, max)}" value="1" aria-label="Quantity"${disabled ? ' disabled' : ''}>` +
    `<button type="button" data-qty="1" aria-label="Badhao"${disabled ? ' disabled' : ''}>+</button></div>`;
}

document.addEventListener('click', event => {
  const btn = event.target.closest('.mc-qty button[data-qty]');
  if (!btn) return;
  const input = btn.parentElement.querySelector('input');
  const max = Number(input.max) || 1;
  const next = Math.max(1, Math.min(max, (Number(input.value) || 1) + Number(btn.dataset.qty)));
  input.value = next;
  input.dispatchEvent(new Event('input', { bubbles: true }));
});

function galleryHtml(images, alt, opts = {}) {
  const list = (Array.isArray(images) ? images : [])
    .map(x => (typeof x === 'string' ? x : x?.url))
    .filter(Boolean);
  if (!list.length) list.push('https://placehold.co/600x600?text=Memora');
  const many = list.length > 1;
  return `
    <div class="mc-gal" data-count="${list.length}">
      ${many ? `<span class="mc-gal-count">1/${list.length}</span>
        <button class="mc-gal-nav prev" type="button" aria-label="Pichli photo" disabled>‹</button>
        <button class="mc-gal-nav next" type="button" aria-label="Agli photo">›</button>` : ''}
      <div class="mc-gal-track">
        ${list.map((u, i) => `<div class="mc-gal-slide"><img src="${esc(u)}" alt="${esc(alt || '')}" ${i ? 'loading="lazy"' : ''} decoding="async" draggable="false"${i === 0 ? ' id="mainImage"' : ''}></div>`).join('')}
      </div>
      ${many ? `<div class="mc-gal-dots">${list.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>` : ''}
      ${many && opts.thumbs ? `<div class="mc-gal-thumbs">${list.map((u, i) => `<img src="${esc(u)}" alt="" class="${i ? '' : 'on'}" data-i="${i}" loading="lazy">`).join('')}</div>` : ''}
    </div>`;
}

function initGallery(root) {
  (root || document).querySelectorAll('.mc-gal').forEach(gal => {
    if (gal.dataset.ready) return;
    gal.dataset.ready = '1';
    const track = gal.querySelector('.mc-gal-track');
    const n = Number(gal.dataset.count) || 1;
    if (n < 2) return;
    const dots = [...gal.querySelectorAll('.mc-gal-dots i')];
    const thumbs = [...gal.querySelectorAll('.mc-gal-thumbs img')];
    const prev = gal.querySelector('.prev');
    const next = gal.querySelector('.next');
    const count = gal.querySelector('.mc-gal-count');
    const go = i => {
      i = Math.max(0, Math.min(n - 1, i));
      track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
    };
    const sync = () => {
      const i = Math.round(track.scrollLeft / (track.clientWidth || 1));
      dots.forEach((d, k) => d.classList.toggle('on', k === i));
      thumbs.forEach((t, k) => t.classList.toggle('on', k === i));
      if (count) count.textContent = `${i + 1}/${n}`;
      if (prev) prev.disabled = i === 0;
      if (next) next.disabled = i === n - 1;
      gal.dataset.index = i;
    };
    const cur = () => Number(gal.dataset.index) || 0;
    track.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
    prev?.addEventListener('click', () => go(cur() - 1));
    next?.addEventListener('click', () => go(cur() + 1));
    thumbs.forEach(t => t.addEventListener('click', () => go(Number(t.dataset.i))));
    gal.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') go(cur() - 1);
      if (e.key === 'ArrowRight') go(cur() + 1);
    });
  });
}


/* =====================================
   SHARED CURRENT USER REQUEST

   Render Free backend may wake slowly.
   Never interpret a 4-second delay
   as proof that the user logged out.

   Failed network requests are not cached
   permanently within the page.
===================================== */

let mcCurrentUserPromise = null;

async function currentUser() {
  if (mcCurrentUserPromise) {
    return mcCurrentUserPromise;
  }

  const request = (async () => {
    try {
      const data = await api('/auth/me');

      return data.user || null;

    } catch (error) {
      if (
        error?.status === 401 ||
        error?.code === 'UNAUTHORIZED'
      ) {
        return null;
      }

      console.warn(
        'Current user check unavailable:',
        error.message
      );

      // Backend/network failure must not
      // be treated as a confirmed logout.
      throw error;
    }
  })();

  mcCurrentUserPromise = request;

  try {
    return await request;
  } catch (error) {
    mcCurrentUserPromise = null;
    throw error;
  }
}


/* =====================================
   REQUIRE LOGIN

   Redirect only when login is
   actually missing or expired.
===================================== */

async function requireLogin() {
  try {
    const data = await api('/auth/me');

    if (data.user) {
      return data.user;
    }

    location.href =
      BASE +
      '/frontend/login.html?next=' +
      encodeURIComponent(
        location.pathname + location.search
      );

    return null;

  } catch (error) {
    if (
      error?.status === 401 ||
      error?.code === 'UNAUTHORIZED'
    ) {
      location.href =
        BASE +
        '/frontend/login.html?next=' +
        encodeURIComponent(
          location.pathname + location.search
        );

      return null;
    }

    console.error('Login check error:', error);

    toast(
      error?.message ||
      'Account verify nahi ho pa raha hai.',
      'error'
    );

    return null;
  }
}


/* =====================================
   LOGOUT
===================================== */

async function logoutUser() {
  const button = $('#logoutBtn');
  const oldText = button?.textContent;

  if (button) {
    button.disabled = true;
    button.textContent = 'Logging out...';
  }

  try {
    await api('/auth/logout', {
      method: 'POST'
    });

    mcCurrentUserPromise = null;

    location.href =
      BASE + '/frontend/login.html';

  } catch (error) {
    console.error('Logout error:', error);

    toast(
      error?.message || 'Logout nahi ho pa raha hai.',
      'error'
    );

    if (button) {
      button.disabled = false;
      button.textContent = oldText || 'Logout';
    }
  }
}


/* =====================================
   DESKTOP NAVIGATION
===================================== */

async function nav() {
  const element = $('#nav');

  if (!element) return;

  /*
   Display basic navigation immediately.
   This does not require Render backend.
  */

  element.innerHTML = `
    <div class="container nav">
      <a
        class="brand"
        href="${BASE}/frontend/index.html"
        aria-label="Memora Creations home"
      >
        <img
          class="brand-logo"
          src="${BASE}/frontend/images/logo.png"
          alt="Memora Creations logo"
          width="52"
          height="52"
          decoding="async"
        >
        <span class="brand-text">MEMORA CREATIONS</span>
      </a>

      <form class="search" id="globalSearch">
        <input
          class="input"
          placeholder="Search products..."
          name="q"
          autocomplete="off"
        >

        <button class="btn" type="submit">
          Search
        </button>
      </form>

      <div class="navlinks" id="mcDesktopNavLinks">
        <a href="${BASE}/frontend/index.html">
          Home
        </a>

        <a href="${BASE}/frontend/products.html">
          Products
        </a>

        <span class="muted" aria-live="polite">
          Checking account...
        </span>
      </div>
    </div>
  `;

  const searchForm = $('#globalSearch');

  searchForm?.addEventListener('submit', event => {
    event.preventDefault();

    const query = String(
      new FormData(event.currentTarget).get('q') || ''
    ).trim();

    location.href =
      BASE +
      '/frontend/products.html?q=' +
      encodeURIComponent(query);
  });

  let user;

  try {
    user = await currentUser();
  } catch (error) {
    const links = $('#mcDesktopNavLinks');

    if (links) {
      links.innerHTML = `
        <a href="${BASE}/frontend/index.html">
          Home
        </a>

        <a href="${BASE}/frontend/products.html">
          Products
        </a>

        <span class="muted" aria-live="polite">
          Account temporarily unavailable
        </span>

        <button
          class="btn secondary"
          id="mcRetryNav"
          type="button"
        >
          Retry
        </button>
      `;

      $('#mcRetryNav')?.addEventListener(
        'click',
        () => {
          mcCurrentUserPromise = null;
          nav();
          bottomNav();
        }
      );
    }

    return;
  }

  const links = $('#mcDesktopNavLinks');

  if (!links) return;

  links.innerHTML = `
    <a href="${BASE}/frontend/index.html">
      Home
    </a>

    <a href="${BASE}/frontend/products.html">
      Products
    </a>

    ${
      user
        ? `
          <a
            href="${BASE}/frontend/wishlist.html"
            aria-label="My Wishlist"
          >
            ♥ Wishlist
          </a>

          <a href="${BASE}/frontend/orders.html">
            Orders
          </a>

          <a href="${BASE}/frontend/profile.html">
            Profile
          </a>

          <a href="${BASE}/frontend/cart.html">
            Cart (<span id="cartCount">0</span>)
          </a>

          <button
            class="btn secondary"
            id="logoutBtn"
            type="button"
          >
            Logout
          </button>
        `
        : `
          <a
            class="btn secondary"
            href="${BASE}/frontend/login.html"
          >
            Login
          </a>
        `
    }
  `;

  $('#logoutBtn')?.addEventListener(
    'click',
    logoutUser
  );

  if (user) {
    updateCartCount();
  }
}


/* =====================================
   CART COUNTER
===================================== */

async function updateCartCount() {
  const element = $('#cartCount');

  if (!element) return;

  try {
    const data = await api('/cart');

    const count = (data.cart?.items || [])
      .reduce(
        (total, item) =>
          total + Number(item.quantity || 0),
        0
      );

    element.textContent = count;

  } catch (error) {
    console.warn('Cart count unavailable:', error);

    if (element) {
      element.textContent = '0';
    }
  }
}


/* =====================================
   MOBILE BOTTOM NAVIGATION
===================================== */

async function bottomNav() {
  const element = $('#bottomNav');

  if (!element) return;

  document.body.classList.add('has-bottomnav');

  const path = location.pathname.toLowerCase();

  const active = page =>
    path.includes(page) ? 'active' : '';

  const homeLink = `
    <a
      href="${BASE}/frontend/index.html"
      class="${active('/frontend/index.html')}"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M3 10.5L12 3l9 7.5"></path>
        <path d="M5 9.5V20h14V9.5"></path>
      </svg>
      <span>Home</span>
    </a>
  `;

  const productsLink = `
    <a
      href="${BASE}/frontend/products.html"
      class="${active('/frontend/products.html')}"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="3" y="3" width="7" height="7" rx="1"></rect>
        <rect x="14" y="3" width="7" height="7" rx="1"></rect>
        <rect x="3" y="14" width="7" height="7" rx="1"></rect>
        <rect x="14" y="14" width="7" height="7" rx="1"></rect>
      </svg>
      <span>Products</span>
    </a>
  `;

  // Home and Products are available
  // even if the backend is waking up.

  element.innerHTML =
    homeLink +
    productsLink +
    `
      <span
        class="mc-account-loading"
        aria-live="polite"
        style="font-size:11px;text-align:center"
      >
        Loading...
      </span>
    `;

  let user;

  try {
    user = await currentUser();
  } catch (error) {
    element.innerHTML =
      homeLink +
      productsLink +
      `
        <button
          id="mcRetryMobile"
          type="button"
          style="
            border:0;
            background:transparent;
            font-size:11px;
            color:inherit;
          "
        >
          Retry
        </button>
      `;

    $('#mcRetryMobile')?.addEventListener(
      'click',
      () => {
        mcCurrentUserPromise = null;
        nav();
        bottomNav();
      }
    );

    return;
  }

  element.innerHTML = `
    ${homeLink}
    ${productsLink}

    ${
      user
        ? `
          <a
            href="${BASE}/frontend/cart.html"
            class="${active('/frontend/cart.html')}"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="9" cy="20" r="1"></circle>
              <circle cx="18" cy="20" r="1"></circle>
              <path d="M3 4h2l2 11h11l2-8H7"></path>
            </svg>
            <span>Cart</span>
          </a>

          <a
            href="${BASE}/frontend/orders.html"
            class="${active('/frontend/orders.html')}"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M8 6h13"></path>
              <path d="M8 12h13"></path>
              <path d="M8 18h13"></path>
              <path d="M3 6h.01"></path>
              <path d="M3 12h.01"></path>
              <path d="M3 18h.01"></path>
            </svg>
            <span>Orders</span>
          </a>

          <a
            href="${BASE}/frontend/wishlist.html"
            class="${active('/frontend/wishlist.html')}"
            aria-label="My Wishlist"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M20.8 4.6a5.6 5.6 0 0 0-7.9 0L12 5.5l-.9-.9a5.6 5.6 0 1 0-7.9 7.9L12 21l8.8-8.5a5.6 5.6 0 0 0 0-7.9Z"></path>
            </svg>
            <span>Wishlist</span>
          </a>

          <a
            href="${BASE}/frontend/profile.html"
            class="${active('/frontend/profile.html')}"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="8" r="4"></circle>
              <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"></path>
            </svg>
            <span>Profile</span>
          </a>
        `
        : `
          <a
            href="${BASE}/frontend/login.html"
            class="${active('/frontend/login.html')}"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="8" r="4"></circle>
              <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"></path>
            </svg>
            <span>Login</span>
          </a>
        `
    }
  `;
}


/* =====================================
   START
===================================== */

function startNavigation() {
  Promise.all([
    nav(),
    bottomNav()
  ]).catch(error => {
    console.error(
      'Navigation initialization error:',
      error
    );
  });
}

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    startNavigation,
    { once: true }
  );
} else {
  startNavigation();
}


/* =====================================
   GLOBAL EXPORTS
===================================== */

window.MC = {
  api,
  $,
  $$,
  money,
  esc,
  toast,
  showCartPopup,
  galleryHtml,
  qtyHtml,
  API_BASE: API,
  ratingHtml,
  initGallery,
  currentUser,
  requireLogin,
  updateCartCount,
  logoutUser,
  ApiError
};
