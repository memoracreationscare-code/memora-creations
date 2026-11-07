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
  wa.className = 'mc-wa';
  wa.href = 'https://wa.me/918874050204?text=' +
    encodeURIComponent('Namaste Memora Creations, mujhe ek sawal poochna hai.');
  wa.target = '_blank';
  wa.rel = 'noopener noreferrer';
  wa.setAttribute('aria-label', 'Chat on WhatsApp');
  wa.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3C9 3 3.4 8.6 3.4 15.5c0 2.3.6 4.4 1.7 6.3L3 29l7.4-1.9a12.6 12.6 0 0 0 5.6 1.3c7 0 12.6-5.6 12.6-12.5S23 3 16 3zm0 22.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-4.4 1.1 1.2-4.2-.3-.4a10.2 10.2 0 0 1-1.6-5.5C5.5 9.9 10.2 5.3 16 5.3s10.5 4.6 10.5 10.2S21.8 25.8 16 25.8zm5.7-7.6c-.3-.2-1.8-.9-2.1-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1a8.4 8.4 0 0 1-4.2-3.7c-.3-.6.3-.5.9-1.7.1-.2 0-.4 0-.5l-1-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4s-1 1-1 2.5 1.1 2.9 1.2 3.1c.2.2 2.1 3.3 5.2 4.5 2 .8 2.7.8 3.7.7.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4s-.3-.2-.6-.4z"/></svg>';

  box.append(top, wa);

  function mount() {
    document.body.appendChild(box);
    const toggle = () => top.classList.toggle('show', window.scrollY > 500);
    window.addEventListener('scroll', toggle, { passive: true });
    toggle();
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
