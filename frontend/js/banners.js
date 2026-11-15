/*
  Homepage banner slider. Banners are added in Admin -> Banners.
  With no banners nothing is shown and the page looks as before.
*/
(() => {

  const hero = document.querySelector('.home-hero');

  if (!hero || !window.MC || typeof window.MC.api !== 'function') return;

  const esc = window.MC.esc;

  function safeLink(link) {
    if (!link) return '';
    if (/^https:\/\//i.test(link)) return link;
    if (link.startsWith('/')) return link;

    return '/frontend/' + link.replace(/^\/+/, '');
  }

  function build(banners) {
    const root = document.createElement('section');

    root.className = 'mc-slider';
    root.setAttribute('aria-roledescription', 'carousel');
    root.setAttribute('aria-label', 'Offers');
    root.innerHTML = `
      <style>
        .mc-slider{position:relative;max-width:1200px;margin:14px auto 0;border-radius:18px;overflow:hidden;background:#f1e7d8;box-shadow:0 8px 26px rgba(0,0,0,.12)}
        .mc-track{display:flex;transition:transform .55s ease;will-change:transform;touch-action:pan-y;user-select:none;-webkit-user-select:none}
        .mc-track.drag{transition:none}
        .mc-slide img{-webkit-user-drag:none}
        .mc-slide{position:relative;flex:0 0 100%;display:block;color:#fff;text-decoration:none}
        .mc-slide img{display:block;width:100%;aspect-ratio:16/6;object-fit:cover}
        .mc-arrow{box-shadow:0 2px 8px rgba(0,0,0,.25)}
        .mc-cap{position:absolute;left:0;right:0;bottom:0;padding:34px 26px 22px;background:linear-gradient(transparent,rgba(0,0,0,.62))}
        .mc-cap b{display:block;font-size:clamp(18px,3.2vw,32px);line-height:1.15}
        .mc-cap span{display:block;margin-top:4px;font-size:clamp(13px,1.8vw,17px);opacity:.95}
        .mc-cap em{display:inline-block;margin-top:10px;padding:8px 16px;border-radius:999px;background:#b98a2c;color:#fff;font-style:normal;font-weight:800;font-size:14px}
        .mc-arrow{position:absolute;top:50%;transform:translateY(-50%);width:38px;height:38px;border:0;border-radius:50%;background:rgba(255,255,255,.85);color:#5b3a24;font-size:20px;cursor:pointer}
        .mc-arrow.prev{left:10px}.mc-arrow.next{right:10px}
        .mc-dots{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);display:flex;justify-content:center;gap:7px;padding:5px 9px;border-radius:999px;background:rgba(0,0,0,.38)}
        .mc-dots button{width:8px;height:8px;border-radius:50%;border:0;background:rgba(255,255,255,.6);padding:0;cursor:pointer;transition:width .25s}
        .mc-dots button.on{background:#fff;width:20px;border-radius:8px}
        @media (max-width:640px){.mc-slide.has-m img{aspect-ratio:4/3}.mc-arrow{display:none}.mc-cap{padding:26px 16px 26px}.mc-slider{border-radius:14px;margin-top:10px}}
        @media (prefers-reduced-motion:reduce){.mc-track{transition:none}}
      </style>
      <div class="mc-track">
        ${banners.map((b, i) => {
          const link = safeLink(b.link);
          const tag = link ? 'a' : 'div';
          const href = link ? ` href="${esc(link)}"${/^https:/i.test(link) ? ' target="_blank" rel="noopener noreferrer"' : ''}` : '';
          const picture = b.mobileImageUrl
            ? `<picture><source media="(max-width:640px)" srcset="${esc(b.mobileImageUrl)}"><img src="${esc(b.imageUrl)}" alt="${esc(b.title || 'Offer')}"></picture>`
            : `<img src="${esc(b.imageUrl)}" alt="${esc(b.title || 'Offer')}">`;

          return `<${tag} class="mc-slide${b.mobileImageUrl ? ' has-m' : ''}"${href} draggable="false">${picture}
            ${(b.title || b.subtitle || b.buttonText) ? `<div class="mc-cap">
              ${b.title ? `<b>${esc(b.title)}</b>` : ''}
              ${b.subtitle ? `<span>${esc(b.subtitle)}</span>` : ''}
              ${b.buttonText && link ? `<em>${esc(b.buttonText)}</em>` : ''}
            </div>` : ''}</${tag}>`;
        }).join('')}
      </div>
      ${banners.length > 1 ? `
        <button class="mc-arrow prev" type="button" aria-label="Previous">‹</button>
        <button class="mc-arrow next" type="button" aria-label="Next">›</button>
        <div class="mc-dots">${banners.map((_, i) => `<button type="button" aria-label="Banner ${i + 1}"></button>`).join('')}</div>` : ''}
    `;

    return root;
  }

  function run(root, count) {
    if (count < 2) return;

    const track = root.querySelector('.mc-track');
    const dots = [...root.querySelectorAll('.mc-dots button')];
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let index = 0;
    let timer = null;

    const show = i => {
      index = (i + count) % count;
      track.style.transform = `translateX(-${index * 100}%)`;
      dots.forEach((d, n) => d.classList.toggle('on', n === index));
    };

    const stop = () => { clearInterval(timer); timer = null; };

    const start = () => {
      stop();
      if (reduce) return;
      timer = setInterval(() => { if (!document.hidden) show(index + 1); }, 4500);
    };

    root.querySelector('.prev').addEventListener('click', () => { show(index - 1); start(); });
    root.querySelector('.next').addEventListener('click', () => { show(index + 1); start(); });
    dots.forEach((d, n) => d.addEventListener('click', () => { show(n); start(); }));
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    root.setAttribute('tabindex', '0');
    root.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') { show(index - 1); start(); }
      if (e.key === 'ArrowRight') { show(index + 1); start(); }
    });

    /* finger / mouse drag: the banner follows the pointer, then snaps */
    let startX = null;
    let startY = 0;
    let dx = 0;
    let dragging = false;
    let moved = false;

    root.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest('.mc-arrow, .mc-dots')) return;
      startX = e.clientX;
      startY = e.clientY;
      dx = 0;
      dragging = false;
      moved = false;
      stop();
    });

    root.addEventListener('pointermove', e => {
      if (startX === null) return;
      const mx = e.clientX - startX;
      const my = e.clientY - startY;

      if (!dragging) {
        if (Math.abs(mx) < 8 || Math.abs(mx) < Math.abs(my)) return;
        dragging = true;
        track.classList.add('drag');
        try { root.setPointerCapture(e.pointerId); } catch (_) {}
      }

      dx = mx;
      moved = true;
      const w = root.clientWidth || 1;
      track.style.transform = `translateX(calc(-${index * 100}% + ${dx}px))`;
    });

    const finish = () => {
      if (startX === null) return;
      const w = root.clientWidth || 1;
      track.classList.remove('drag');
      if (dragging) show(index + (Math.abs(dx) > w * 0.15 ? (dx < 0 ? 1 : -1) : 0));
      startX = null;
      dragging = false;
      start();
    };

    root.addEventListener('pointerup', finish);
    root.addEventListener('pointercancel', finish);

    /* a drag must not open the banner link */
    root.addEventListener('click', e => {
      if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
    }, true);

    document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });

    show(0);
    start();
  }

  window.MC.api('/banners')
    .then(data => {
      const banners = (data.banners || []).filter(b => b.imageUrl);

      if (!banners.length) return;

      const root = build(banners);

      hero.parentNode.insertBefore(root, hero);
      run(root, banners.length);
    })
    .catch(() => { /* no banners: the page stays as it was */ });

})();
