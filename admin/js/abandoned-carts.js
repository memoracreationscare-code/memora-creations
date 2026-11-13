(() => {

  const { api, $, esc, money, toast } = window.MC;

  const SITE_CART_LINK =
    'https://memoracreationscare.in/frontend/cart.html';

  const DEFAULT_TEMPLATE =
    'Namaste {name} ji 🙏\n' +
    'Aapne Memora Creations par {items} cart me rakha tha, ' +
    'aur ye abhi bhi available hai 😊\n' +
    'Order karne ke liye yahan click karein: {link}\n' +
    'Koi madad chahiye to bata dijiye.';

  const TEMPLATE_KEY = 'mc_abandoned_template';
  const SENT_KEY = 'mc_abandoned_sent';


  /* ---------- browser storage (can be unavailable) ---------- */

  function readStore(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : raw;
    } catch {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore: the page still works without storage */
    }
  }

  function readSent() {
    try {
      const parsed = JSON.parse(readStore(SENT_KEY, '{}'));
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  // A cart is "sent" only for the exact moment it was last changed,
  // so if the customer changes the cart again it shows up as new.
  const sentId = cart => `${cart.cartId}:${cart.lastUpdated}`;


  /* ---------- message ---------- */

  function itemsText(items) {
    const shown = items
      .slice(0, 3)
      .map(i => (i.quantity > 1 ? `${i.name} x${i.quantity}` : i.name));

    const extra = items.length - shown.length;

    return extra > 0
      ? `${shown.join(', ')} aur ${extra} product`
      : shown.join(', ');
  }

  function firstName(fullName) {
    return String(fullName || '').trim().split(/\s+/)[0] || 'Customer';
  }

  function buildMessage(template, cart) {
    return template
      .replaceAll('{name}', firstName(cart.fullName))
      .replaceAll('{items}', itemsText(cart.items))
      .replaceAll('{link}', SITE_CART_LINK);
  }

  function whatsappUrl(cart, template) {
    const mobile = String(cart.mobile || '').replace(/\D/g, '').slice(-10);

    return (
      `https://wa.me/91${mobile}?text=` +
      encodeURIComponent(buildMessage(template, cart))
    );
  }

  function timeAgo(hours) {
    if (hours < 1) return 'less than 1 hour ago';
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

    const days = Math.floor(hours / 24);

    return `${days} day${days === 1 ? '' : 's'} ago`;
  }


  /* ---------- page ---------- */

  const list = $('#acList');
  const summary = $('#acSummary');
  const hoursSelect = $('#acHours');
  const templateBox = $('#acTemplate');

  let carts = [];

  templateBox.value = readStore(TEMPLATE_KEY, DEFAULT_TEMPLATE);

  function currentTemplate() {
    return templateBox.value.trim() || DEFAULT_TEMPLATE;
  }

  function cardHtml(cart, sent) {
    const itemLines = cart.items
      .map(i =>
        `${esc(i.name)} × ${i.quantity}` +
        (i.inStock ? '' : ' <span class="oos">(out of stock)</span>')
      )
      .join('<br>');

    return `
      <article class="ac-card ${sent ? 'sent' : ''}" data-id="${esc(cart.cartId)}">
        <div>
          <div class="ac-name">${esc(cart.fullName)}</div>
          <div class="ac-meta">
            ${esc(cart.mobile)}<br>
            Last active ${esc(timeAgo(cart.hoursAgo))}
          </div>
        </div>

        <div>
          <div class="ac-items">${itemLines}</div>
          <div class="ac-total">Cart total: ${esc(money(cart.total))}</div>
        </div>

        <div class="ac-actions">
          <a class="ac-wa" target="_blank" rel="noopener noreferrer"
             data-wa="${esc(cart.cartId)}"
             href="${esc(whatsappUrl(cart, currentTemplate()))}">
            Send WhatsApp
          </a>
          <button class="ac-mark" type="button" data-mark="${esc(cart.cartId)}">
            ${sent ? '✓ Messaged (undo)' : 'Mark as messaged'}
          </button>
        </div>
      </article>`;
  }

  function render() {
    const sentMap = readSent();

    if (!carts.length) {
      summary.textContent = '';
      list.innerHTML =
        '<div class="ac-state">No abandoned carts for this time range.</div>';
      return;
    }

    const pending = carts.filter(c => !sentMap[sentId(c)]).length;

    summary.textContent =
      `${carts.length} abandoned cart${carts.length === 1 ? '' : 's'} ` +
      `(${pending} not messaged yet)`;

    list.innerHTML = carts
      .map(cart => cardHtml(cart, Boolean(sentMap[sentId(cart)])))
      .join('');
  }

  async function load() {
    list.innerHTML = '<div class="ac-state">Loading...</div>';
    summary.textContent = '';

    try {
      const data = await api(
        `/admin/abandoned-carts?hours=${encodeURIComponent(hoursSelect.value)}`
      );

      carts = data.abandonedCarts || [];
      render();

    } catch (e) {
      carts = [];
      summary.textContent = '';
      list.innerHTML =
        '<div class="ac-state">Could not load carts. If the server was asleep, wait a minute and press Refresh.</div>';
      toast(e.message || 'Could not load abandoned carts.', 'error');
    }
  }

  list.addEventListener('click', event => {

    // Opening WhatsApp counts as messaged, so the card turns green.
    const wa = event.target.closest('[data-wa]');

    if (wa) {
      const cart = carts.find(c => c.cartId === wa.dataset.wa);

      if (cart) {
        const sentMap = readSent();
        sentMap[sentId(cart)] = Date.now();
        writeStore(SENT_KEY, JSON.stringify(sentMap));
        setTimeout(render, 300);
      }

      return;
    }

    const mark = event.target.closest('[data-mark]');

    if (mark) {
      const cart = carts.find(c => c.cartId === mark.dataset.mark);

      if (!cart) return;

      const sentMap = readSent();

      if (sentMap[sentId(cart)]) delete sentMap[sentId(cart)];
      else sentMap[sentId(cart)] = Date.now();

      writeStore(SENT_KEY, JSON.stringify(sentMap));
      render();
    }
  });

  templateBox.addEventListener('input', () => {
    writeStore(TEMPLATE_KEY, templateBox.value);

    // Refresh only the links, not the whole list, while typing.
    list.querySelectorAll('[data-wa]').forEach(link => {
      const cart = carts.find(c => c.cartId === link.dataset.wa);
      if (cart) link.href = whatsappUrl(cart, currentTemplate());
    });
  });

  hoursSelect.addEventListener('change', load);
  $('#acRefresh').addEventListener('click', load);

  (async () => {
    if (await window.requireAdmin()) load();
  })();

})();
