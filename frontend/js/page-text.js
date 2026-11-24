/*
  Policy / About pages: if the owner wrote new text in Admin -> Website pages,
  show it instead of the page's built-in text. Plain text only (textContent),
  so nothing the owner types can run as code. Any failure leaves the page as is.

    # Heading      -> big heading
    ## Sub heading -> small heading
    - item         -> bullet
    blank line     -> new paragraph
*/
(() => {
  const slug = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');

  if (!['shipping-policy', 'return-refund-policy', 'privacy-policy', 'terms', 'about'].includes(slug)) return;

  const main = document.querySelector('main');

  if (!main) return;

  function build(text) {
    const box = document.createElement('div');
    let list = null;
    let para = [];

    const flush = () => {
      if (para.length) {
        const p = document.createElement('p');

        p.textContent = para.join(' ');
        box.appendChild(p);
        para = [];
      }
    };

    String(text).split('\n').forEach(raw => {
      const line = raw.trim();

      if (!line) { flush(); list = null; return; }

      let el = null;

      if (line.startsWith('## ')) { el = document.createElement('h3'); el.textContent = line.slice(3); }
      else if (line.startsWith('# ')) { el = document.createElement('h2'); el.textContent = line.slice(2); }
      else if (line.startsWith('- ')) {
        if (!list) { flush(); list = document.createElement('ul'); box.appendChild(list); }
        const li = document.createElement('li');

        li.textContent = line.slice(2);
        list.appendChild(li);
        return;
      }

      if (el) { flush(); list = null; box.appendChild(el); return; }

      list = null;
      para.push(line);
    });

    flush();

    return box;
  }

  fetch('https://api.memoracreationscare.in/api/settings/pages/' + slug)
    .then(r => (r.ok ? r.json() : null))
    .then(d => {
      const text = d && typeof d.body === 'string' ? d.body.trim() : '';

      if (!text) return;

      const box = build(text);
      const css = document.createElement('style');

      box.className = 'mc-page-body';
      css.textContent =
        '.mc-page-body{max-width:820px;margin:28px auto;padding:0 6px;color:#3a2a1d;line-height:1.75;font-size:16px}' +
        '.mc-page-body h2{margin:30px 0 10px;font-size:24px}.mc-page-body h3{margin:22px 0 8px;font-size:19px}' +
        '.mc-page-body p{margin:0 0 14px}.mc-page-body ul{margin:0 0 14px;padding-left:22px}.mc-page-body li{margin:5px 0}';

      if (slug === 'about') {
        const blocks = main.querySelectorAll('.about-section, .about-values');

        if (!blocks.length) return;

        blocks[0].before(box);
        blocks.forEach(el => el.remove());
      } else {
        const layout = main.querySelector('[class$="-layout"]');

        if (!layout) return;

        layout.replaceWith(box);
      }

      document.head.appendChild(css);
    })
    .catch(() => {});
})();
