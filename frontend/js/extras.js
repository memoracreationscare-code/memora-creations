/*
  MEMORA CREATIONS - EXTRAS
  Adds two small helpers to every customer page:
  - a floating WhatsApp chat button
  - a "back to top" button
  Styles are injected here so no extra CSS file is needed.
*/
(() => {
  if (window.__mcExtras) return;
  window.__mcExtras = true;

  const style = document.createElement('style');
  style.textContent = `
    .mc-float{position:fixed;right:16px;z-index:900;display:flex;flex-direction:column;gap:12px;align-items:flex-end;bottom:20px}
    .mc-wa,.mc-top{border:0;cursor:pointer;display:grid;place-items:center;border-radius:50%;box-shadow:0 8px 22px rgba(0,0,0,.22);transition:transform .2s ease,opacity .25s ease}
    .mc-wa{width:56px;height:56px;background:#25d366;color:#fff;text-decoration:none}
    .mc-wa:hover,.mc-top:hover{transform:translateY(-2px)}
    .mc-wa svg{width:30px;height:30px;fill:#fff}
    .mc-top{width:42px;height:42px;background:#8a5a3b;color:#fff;font-size:18px;line-height:1;opacity:0;pointer-events:none}
    .mc-top.show{opacity:1;pointer-events:auto}
    @media (max-width:768px){.mc-float{bottom:100px;right:12px}}
    .mc-footer-address{display:block;margin:10px auto 0;font-size:13px;line-height:1.6;opacity:.85;text-align:center}
    .premium-footer .footer-links .mc-footer-address{text-align:left;margin:8px 0 0}
    @media print{.mc-float{display:none}}
  `;
  document.head.appendChild(style);

  const box = document.createElement('div');
  box.className = 'mc-float';

  const top = document.createElement('button');
  top.type = 'button';
  top.className = 'mc-top';
  top.setAttribute('aria-label', 'Back to top');
  top.textContent = '↑';
  top.addEventListener('click', () =>
    window.scrollTo({ top: 0, behavior: 'smooth' })
  );

  const wa = document.createElement('a');
  const wa_link = wa;
  wa.className = 'mc-wa';
  wa.href = 'https://wa.me/918874050204?text=' +
    encodeURIComponent('Namaste Memora Creations, mujhe ek sawal poochna hai.');
  wa.target = '_blank';
  wa.rel = 'noopener noreferrer';
  wa.setAttribute('aria-label', 'Chat on WhatsApp');
  wa.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3C9 3 3.4 8.6 3.4 15.5c0 2.3.6 4.4 1.7 6.3L3 29l7.4-1.9a12.6 12.6 0 0 0 5.6 1.3c7 0 12.6-5.6 12.6-12.5S23 3 16 3zm0 22.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-4.4 1.1 1.2-4.2-.3-.4a10.2 10.2 0 0 1-1.6-5.5C5.5 9.9 10.2 5.3 16 5.3s10.5 4.6 10.5 10.2S21.8 25.8 16 25.8zm5.7-7.6c-.3-.2-1.8-.9-2.1-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1a8.4 8.4 0 0 1-4.2-3.7c-.3-.6.3-.5.9-1.7.1-.2 0-.4 0-.5l-1-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4s-1 1-1 2.5 1.1 2.9 1.2 3.1c.2.2 2.1 3.3 5.2 4.5 2 .8 2.7.8 3.7.7.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4s-.3-.2-.6-.4z"/></svg>';

  box.append(top, wa);

  // Show the shop address in the footer of every page.
  function addAddress() {
    const footer = document.querySelector('footer');

    if (!footer || footer.querySelector('.mc-footer-address')) return;

    const line = document.createElement('p');
    line.className = 'mc-footer-address';
    line.textContent =
      '📍 Memora Creations, Kotwa Kalan, Post Kotwa Bazar, ' +
      'Kushinagar, Uttar Pradesh – 274305';
    footer.appendChild(line);
  }

  /* =====================================
     SHOP SETTINGS (Admin -> Store Settings)

     Contact details, hero text, store-closed
     notice, COD on/off and the free-delivery
     bar all come from the admin panel.
  ===================================== */

  let settings = null;

  const DEFAULT_WA = '918874050204';

  function prettyPhone(digits) {
    const d = String(digits || '');

    return d.length === 12 && d.startsWith('91')
      ? '+91 ' + d.slice(2, 7) + ' ' + d.slice(7)
      : '+' + d;
  }

  function applyContact(s) {
    const wa = String(s.whatsapp || DEFAULT_WA);

    if (wa !== DEFAULT_WA) {
      document.querySelectorAll('a[href*="wa.me/' + DEFAULT_WA + '"]').forEach(a => {
        a.href = a.href.replace('wa.me/' + DEFAULT_WA, 'wa.me/' + wa);
      });

      const pretty = prettyPhone(wa);
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const hits = [];

      while (walker.nextNode()) {
        if (walker.currentNode.nodeValue.includes('+91 88740 50204')) hits.push(walker.currentNode);
      }

      hits.forEach(n => { n.nodeValue = n.nodeValue.replace(/\+91 88740 50204/g, pretty); });
    }

    wa_link.href = 'https://wa.me/' + wa + '?text=' +
      encodeURIComponent('Namaste Memora Creations, mujhe ek sawal poochna hai.');

    const line = document.querySelector('.mc-footer-address');

    if (line && s.address) line.textContent = '📍 Memora Creations, ' + s.address;

    const footer = document.querySelector('footer');

    if (footer && !footer.querySelector('.mc-footer-social')) {
      const links = [
        ['Instagram', s.instagram],
        ['Facebook', s.facebook],
        ['YouTube', s.youtube],
        ['Email', s.email ? 'mailto:' + s.email : ''],
        ['Call', s.phone ? 'tel:' + s.phone : '']
      ].filter(x => x[1]);

      if (links.length) {
        const p = document.createElement('p');
        p.className = 'mc-footer-address mc-footer-social';

        links.forEach(([label, url], i) => {
          const a = document.createElement('a');
          a.textContent = label;
          a.href = url;
          a.style.cssText = 'color:inherit;margin:0 8px;text-decoration:underline';
          if (/^https?:/.test(url)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
          p.appendChild(a);
        });

        footer.appendChild(p);
      }
    }
  }

  function applyHero(s) {
    const hero = document.querySelector('.home-hero');

    if (!hero) return;

    const set = (sel, text) => {
      const el = hero.querySelector(sel);
      if (el && text) el.textContent = text;
    };

    set('.hero-kicker', s.heroKicker);
    set('.hero-description', s.heroDescription);
    set('.hero-primary', s.heroButtonText);

    const h1 = hero.querySelector('h1');

    if (h1 && (s.heroLine1 || s.heroHighlight)) {
      h1.textContent = '';
      h1.append(s.heroLine1 || '', document.createElement('br'));

      const span = document.createElement('span');
      span.textContent = s.heroHighlight || '';
      h1.appendChild(span);
    }
  }

  function applyStoreState(s) {
    if (s.storeOpen === false && !document.getElementById('mcClosedBar')) {
      const bar = document.createElement('div');
      bar.id = 'mcClosedBar';
      bar.setAttribute('role', 'alert');
      bar.style.cssText =
        'position:sticky;top:0;z-index:99998;background:#7a1212;color:#fff;' +
        'text-align:center;padding:10px 14px;font-weight:700;font-size:14px';
      bar.textContent = '🔒 ' + (s.storeClosedMessage || 'Orders are paused right now.');
      document.body.prepend(bar);
    }

    if (s.codEnabled === false) {
      const cod = document.querySelector('input[name="paymentMethod"][value="COD"]');

      if (cod) {
        const label = cod.closest('.payment-option') || cod.parentElement;
        const other = document.querySelector('input[name="paymentMethod"]:not([value="COD"])');

        if (label) label.style.display = 'none';

        if (other) {
          other.checked = true;
          other.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }
  }

  // Cart: "Add Rs X more for FREE delivery".
  window.mcApplyFreeShip = function () {
    const s = settings;

    document.querySelectorAll('.mc-freeship').forEach(el => {
      const subtotal = Number(el.dataset.subtotal || 0);
      const limit = Number(s && s.freeDeliveryAbove);

      if (!s || s.freeDeliveryBar === false || !(limit > 0) || !(subtotal > 0)) {
        el.hidden = true;
        return;
      }

      const left = Math.ceil(limit - subtotal);
      const pct = Math.min(100, Math.round((subtotal / limit) * 100));

      el.hidden = false;
      el.innerHTML =
        '<div style="font-size:13px;font-weight:700;margin-bottom:6px;color:#5b3a24">' +
        (left > 0
          ? '🚚 Add ₹' + left + ' more for <b>FREE delivery</b>'
          : '🎉 You get <b>FREE delivery</b> on this order!') +
        '</div>' +
        '<div style="height:8px;border-radius:99px;background:#eadfd3;overflow:hidden">' +
        '<div style="height:100%;width:' + pct + '%;background:#b98a2c;transition:width .4s"></div></div>';
      el.style.cssText = 'margin:0 0 14px;padding:10px 12px;border-radius:12px;background:#fff8ea';
    });
  };

  function loadSettings() {
    if (!window.MC || typeof window.MC.api !== 'function') return;

    window.MC.api('/settings')
      .then(data => {
        settings = data.settings || null;

        if (!settings) return;

        applyContact(settings);
        applyHero(settings);
        applyStoreState(settings);
        window.mcApplyFreeShip();
      })
      .catch(() => { /* the built-in text stays: never break the page */ });
  }

  function mount() {
    document.body.appendChild(box);
    addAddress();
    loadSettings();
    const toggle = () => top.classList.toggle('show', window.scrollY > 500);
    window.addEventListener('scroll', toggle, { passive: true });
    toggle();
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
