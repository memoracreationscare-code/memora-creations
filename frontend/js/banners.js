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

    return '/memora-creations/frontend/' + link.replace(/^\/+/, '');
  }

  function build(banners) {
    const root = document.createElement('section');

    root.className = 'mc-slider';
    root.setAttribute('aria-roledescription', 'carousel');
    root.setAttribute('aria-label', 'Offers');
    root.innerHTML = `
      <style>
        .mc-slider{position:relative;max-width:1200px;margin:14px auto 0;border-radius:18px;overflow:hidden;background:#f1e7d8;box-shadow:0 8px 26px rgba(0,0,0,.12)}
        .mc-track{display:flex;transition:transform .55s ease;will-change:transform}
        .mc-slide{position:relative;flex:0 0 100%;display:block;color:#fff;text-decoration:none}
        .mc-slide img{display:block;width:100%;aspect-ratio:16/6;object-fit:cover}
        .mc-cap{position:absolute;left:0;right:0;bottom:0;padding:34px 26px 22px;background:linear-gradient(transparent,rgba(0,0,0,.62))}
        .mc-cap b{display:block;font-size:clamp(18px,3.2vw,32px);line-height:1.15}
        .mc-cap span{display:block;margin-top:4px;font-size:clamp(13px,1.8vw,17px);opacity:.95}
        .mc-cap em{display:inline-block;margin-top:10px;padding:8px 16px;border-radius:999px;background:#b98a2c;color:#fff;font-style:normal;font-weight:800;font-size:14px}
        .mc-arrow{position:absolute;top:50%;transform:translateY(-50%);width:38px;height:38px;border:0;border-radius:50%;background:rgba(255,255,255,.85);color:#5b3a24;font-size:20px;cursor:pointer}
        .mc-arrow.prev{left:10px}.mc-arrow.next{right:10px}
        .mc-dots{position:absolute;left:0;right:0;bottom:8px;display:flex;justify-content:center;gap:7px}
        .mc-dots button{width:9px;height:9px;border-radius:50%;border:0;background:rgba(255,255,255,.55);padding:0;cursor:pointer}
        .mc-dots button.on{background:#fff;width:22px;border-radius:9px}
        @media (max-width:640px){.mc-slide img{aspect-ratio:4/3}.mc-arrow{display:none}.mc-cap{padding:26px 16px 26px}}
        @media (prefers-reduced-motion:reduce){.mc-track{transition:none}}
      </style>
      <div class="mc-track">
        ${banners.map((b, i) => {
          const link = safeLink(b.link);
          const tag = link ? 'a' : 'div';
          const href = link ? ` href="${esc(link)}"${/^https:/i.test(link) ? ' target="_blank" rel="noopener noreferrer"' : ''}` : '';
          const picture = b.mobileImageUrl
            ? `<picture><source media="(max-width:640px)" srcset="${esc(b.mobileImageUrl)}"><img src="${esc(b.imageUrl)}" alt="${esc(b.title || 'Offer')}" ${i ? 'loading="lazy"' : ''}></picture>`
            : `<img src="${esc(b.imageUrl)}" alt="${esc(b.title || 'Offer')}" ${i ? 'loading="lazy"' : ''}>`;

          return `<${tag} class="mc-slide"${href}>${picture}
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
    let index = 0;
    let timer = null;

    const show = i => {
      index = (i + count) % count;
      track.style.transform = `translateX(-${index * 100}%)`;
      dots.forEach((d, n) => d.classList.toggle('on', n === index));
    };

    const start = () => {
      stop();

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      timer = setInterval(() => { if (!document.hidden) show(index + 1); }, 5000);
    };

    const stop = () => { clearInterval(timer); };

    root.querySelector('.prev').addEventListener('click', () => { show(index - 1); start(); });
    root.querySelector('.next').addEventListener('click', () => { show(index + 1); start(); });
    dots.forEach((d, n) => d.addEventListener('click', () => { show(n); start(); }));
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);

    let x0 = null;

    root.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; stop(); }, { passive: true });
    root.addEventListener('touchend', e => {
      if (x0 !== null) {
        const dx = e.changedTouches[0].clientX - x0;

        if (Math.abs(dx) > 40) show(index + (dx < 0 ? 1 : -1));
      }

      x0 = null;
      start();
    });

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
