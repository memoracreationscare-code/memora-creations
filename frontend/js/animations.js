/*
  MEMORA CREATIONS - ANIMATIONS

  - Hero text slides in when the home page opens.
  - The hero decor items float gently.
  - Cards, categories, trust items and section titles fade up as
    they scroll into view (also for products loaded later).
  - The main shop button has a soft shine.

  Everything is switched off for people whose device asks for
  reduced motion. Styles are injected here, no extra CSS file.
*/
(() => {
  if (window.__mcAnimations) return;
  window.__mcAnimations = true;

  const reduce =
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduce) return;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes mc-rise{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:none}}
    @keyframes mc-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
    @keyframes mc-shine{0%{transform:translateX(-120%) skewX(-20deg)}60%,100%{transform:translateX(240%) skewX(-20deg)}}

    .hero-kicker,.home-hero h1,.hero-description,.hero-actions{opacity:0;animation:mc-rise .8s cubic-bezier(.2,.7,.2,1) forwards}
    .hero-kicker{animation-delay:.1s}
    .home-hero h1{animation-delay:.25s}
    .hero-description{animation-delay:.4s}
    .hero-actions{animation-delay:.55s}

    .decor-candle-home{animation:mc-float 5s ease-in-out infinite}
    .decor-frame-large{animation:mc-float 6.5s ease-in-out -2s infinite}
    .decor-vase-home{animation:mc-float 5.8s ease-in-out -4s infinite}

    .hero-primary{position:relative;overflow:hidden}
    .hero-primary::after{content:"";position:absolute;top:0;left:0;width:40%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);animation:mc-shine 4s ease-in-out 1.5s infinite;pointer-events:none}

    .mc-reveal{opacity:0;transform:translateY(28px);transition:opacity .7s ease,transform .7s cubic-bezier(.2,.7,.2,1)}
    .mc-reveal.mc-in{opacity:1;transform:none}
  `;
  document.head.appendChild(style);

  const SELECTOR = [
    '.trust-item',
    '.category-card',
    '.premium-product-card',
    '.premium-section h2',
    '.home-care',
    '.mc-faq-item',
    '.footer-grid > div'
  ].join(',');

  const seen = new WeakSet();

  const observer = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;

          const el = entry.target;
          observer.unobserve(el);
          el.style.transitionDelay = (el.__mcDelay || 0) + 'ms';
          el.classList.add('mc-in');

          // Hand control back so existing hover effects work again.
          setTimeout(() => {
            el.classList.remove('mc-reveal', 'mc-in');
            el.style.transitionDelay = '';
          }, 1000 + (el.__mcDelay || 0));
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
    : null;

  function scan(root) {
    if (!observer) return;

    const found = (root.matches && root.matches(SELECTOR))
      ? [root, ...root.querySelectorAll(SELECTOR)]
      : [...root.querySelectorAll(SELECTOR)];

    let index = 0;

    found.forEach(el => {
      if (seen.has(el)) return;
      seen.add(el);

      // Slight stagger for neighbours that appear together.
      el.__mcDelay = Math.min(index++, 5) * 70;
      el.classList.add('mc-reveal');
      observer.observe(el);
    });
  }

  function start() {
    scan(document.body);

    // Products and categories are added after the data loads.
    new MutationObserver(mutations => {
      mutations.forEach(m =>
        m.addedNodes.forEach(node => {
          if (node.nodeType === 1) scan(node);
        })
      );
    }).observe(document.body, { childList: true, subtree: true });

    // Safety net: never leave anything hidden.
    setTimeout(() => {
      document.querySelectorAll('.mc-reveal').forEach(el =>
        el.classList.add('mc-in')
      );
    }, 6000);
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
