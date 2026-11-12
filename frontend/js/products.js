
/* Memora Creations — frontend/js/products.js — full replacement v12 */
(() => {
  'use strict';
  const MC = window.MC;
  if (!MC || typeof MC.api !== 'function') {
    console.error('Memora common app.js must load before products.js');
    return;
  }
  const BASE = '/memora-creations';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => MC.esc(String(value ?? ''));
  const money = value => MC.money(value);
  const placeholder = 'https://placehold.co/600x600?text=Memora';
  const savedIds = new Set();
  let wishlistPromise = null;
  let productsCache = [];
  let popupKeyHandler = null;

  function css() {
    if ($('#mc-wishlist-style')) return;
    const style = document.createElement('style');
    style.id = 'mc-wishlist-style';
    style.textContent = `
      .premium-product-card{position:relative}
      .mc-wish-toggle{cursor:pointer;border:1px solid #e7d6ce;background:#fff;color:#71412c;border-radius:999px;font-weight:700;box-shadow:0 3px 12px #0002;min-height:42px}
      .mc-wish-toggle:focus-visible{outline:3px solid #9b613c;outline-offset:3px}
      .mc-wish-toggle[aria-pressed="true"]{color:#bd2649;border-color:#e5a4b1;background:#fff4f6}
      .mc-wish-toggle:disabled{opacity:.6;cursor:wait}
      .mc-wish-card{position:absolute;top:12px;right:12px;z-index:4;width:44px;height:44px;font-size:29px;line-height:1}
      .mc-wish-single{padding:10px 18px;font-size:15px}
      .mc-product-retry{margin-top:12px;padding:9px 16px;border:0;border-radius:9px;background:#885735;color:white;cursor:pointer;font-weight:700}
    `;
    document.head.appendChild(style);
  }
  css();

  function refreshWishlist() {
    $$('.mc-wish-toggle[data-wish-id]').forEach(button => {
      const saved = savedIds.has(button.dataset.wishId);
      button.setAttribute('aria-pressed', String(saved));
      button.setAttribute('aria-label', saved ? 'Remove from wishlist' : 'Add to wishlist');
      button.textContent = button.classList.contains('mc-wish-card')
        ? (saved ? '♥' : '♡')
        : (saved ? '♥ Saved to Wishlist' : '♡ Save to Wishlist');
    });
  }

  function loadWishlist() {
    if (wishlistPromise) return wishlistPromise;
    wishlistPromise = (async () => {
      try {
        const result = await MC.api('/wishlist');
        savedIds.clear();
        for (const item of (result.products || [])) {
          if (item?._id) savedIds.add(String(item._id));
        }
        refreshWishlist();
      } catch (error) {
        if (![401, 403].includes(error?.status)) {
          console.warn('Wishlist loading:', error?.message);
        }
      }
    })().finally(() => { wishlistPromise = null; });
    return wishlistPromise;
  }

  function goLogin() {
    location.href = BASE + '/frontend/login.html?next=' +
      encodeURIComponent(location.pathname + location.search);
  }

  document.addEventListener('click', async event => {
    const button = event.target.closest('.mc-wish-toggle[data-wish-id]');
    if (!button || button.disabled) return;
    event.preventDefault();
    event.stopPropagation();
    const id = button.dataset.wishId;
    if (!id) return;
    button.disabled = true;
    try {
      const wasSaved = savedIds.has(id);
      await MC.api(wasSaved ? '/wishlist/' + encodeURIComponent(id) : '/wishlist', {
        method: wasSaved ? 'DELETE' : 'POST',
        ...(wasSaved ? {} : { body: JSON.stringify({ productId: id }) })
      });
      if (wasSaved) savedIds.delete(id);
      else savedIds.add(id);
      refreshWishlist();
      MC.toast(wasSaved ? 'Wishlist se remove ho gaya' : 'Wishlist mein save ho gaya');
    } catch (error) {
      if ([401, 403].includes(error?.status)) return goLogin();
      MC.toast(error?.message || 'Wishlist update nahi ho payi', 'error');
    } finally {
      button.disabled = false;
    }
  });

  function stockOf(product) {
    const value = Number(product?.stock);
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  }

  function safeQuantity(value, stock) {
    const available = Math.max(0, Math.floor(Number(stock) || 0));
    if (available < 1) return 0;
    const requested = Math.floor(Number(value));
    return Math.min(available, Math.max(1, Number.isFinite(requested) ? requested : 1));
  }

  function discountOf(product) {
    const original = Number(product.originalPrice) || 0;
    const selling = Number(product.sellingPrice) || 0;
    if (original <= 0 || selling >= original) return 0;
    return Math.max(0, Math.min(100, Math.round((original - selling) * 100 / original)));
  }

  function pictureOf(product) {
    return product.images?.[0]?.url || placeholder;
  }

  function priceMarkup(product, prefix) {
    return `<span class="${prefix === 'premium' ? 'premium-price' : ''}">${money(product.sellingPrice)}</span>` +
      (Number(product.originalPrice) > Number(product.sellingPrice)
        ? `<span class="${prefix === 'premium' ? 'premium-old-price' : 'old'}">${money(product.originalPrice)}</span>`
        : '');
  }

  /* "🔥 Diwali Sale · 20% off · ends in 2d 5h" while a festival sale is running */
  function saleLeft(endsAt) {
    const ms = new Date(endsAt) - Date.now();
    if (!(ms > 0)) return '';
    const d = Math.floor(ms / 864e5);
    const h = Math.floor((ms % 864e5) / 36e5);
    const m = Math.floor((ms % 36e5) / 6e4);
    return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${Math.max(1, m)}m`;
  }

  function saleBanner(product) {
    const s = product.sale;
    if (!s || !s.applied || !s.endsAt || !saleLeft(s.endsAt)) return '';
    return `<div class="mc-sale-banner" data-ends="${esc(s.endsAt)}" style="margin:8px 0;padding:9px 12px;border-radius:10px;background:#fff1e0;border:1px solid #f0c987;color:#8a3d00;font-weight:700;font-size:14px">🔥 ${esc(s.name || 'Sale')} · ${esc(s.percent)}% off · <span class="mc-sale-left">${esc(saleLeft(s.endsAt))}</span> baaki</div>`;
  }

  setInterval(() => {
    document.querySelectorAll('.mc-sale-banner').forEach(el => {
      const left = saleLeft(el.dataset.ends);
      if (left) el.querySelector('.mc-sale-left').textContent = left;
      else el.remove();
    });
  }, 60000);

  function closePopup() {
    $('#productQuickView')?.remove();
    document.body.style.overflow = '';
    if (popupKeyHandler) {
      document.removeEventListener('keydown', popupKeyHandler);
      popupKeyHandler = null;
    }
  }

  async function addToCart(id, quantity = 1, variantId) {
    try {
      await MC.api('/cart', {
        method: 'POST',
        body: JSON.stringify({ productId: id, quantity, ...(variantId ? { variantId } : {}) })
      });
      await MC.updateCartCount();
      closePopup();
      if (typeof MC.showCartPopup === 'function') MC.showCartPopup();
      else MC.toast('Product cart mein add ho gaya', 'success');
    } catch (error) {
      if ([401, 403].includes(error?.status)) return goLogin();
      MC.toast(error?.message || 'Cart update failed', 'error');
    }
  }

  function buyNow(id, quantity = 1, variantId) {
    location.href = BASE + '/frontend/checkout.html?buyNow=' +
      encodeURIComponent(id) + '&qty=' + encodeURIComponent(quantity) +
      (variantId ? '&variant=' + encodeURIComponent(variantId) : '');
  }

  const hasVariants = product => Array.isArray(product?.variants) && product.variants.length > 0;
  const productPageUrl = product => BASE + '/frontend/product.html?id=' + encodeURIComponent(product._id);

  function openPopup(product) {
    closePopup();
    const stock = stockOf(product);
    const overlay = document.createElement('div');
    overlay.id = 'productQuickView';
    overlay.className = 'product-popup-overlay';
    overlay.innerHTML = `
      <div class="product-popup" role="dialog" aria-modal="true" aria-label="Product quick view">
        <button class="product-popup-close" type="button" aria-label="Close">×</button>
        <div class="product-popup-imagebox">
          ${MC.galleryHtml(product.images, product.name)}
        </div>
        <div class="product-popup-info">
          <span class="pill">${esc(product.category?.name || 'Collection')}</span>
          <h2>${esc(product.name)}</h2>
          ${MC.ratingHtml(product)}
          <div class="product-popup-price">${priceMarkup(product)}</div>
          <p class="muted">${esc(product.description || '')}</p>
          <p>${stock ? `✅ In Stock (${stock})` : '❌ Out of Stock'}</p>
          <div class="field">
            <label for="mcPopupQty">Quantity</label>
            <input id="mcPopupQty" class="input popup-qty" type="number" min="1" max="${Math.max(1, stock)}" value="1" ${stock ? '' : 'disabled'}>
          </div>
          ${hasVariants(product) ? `
          <div class="product-popup-actions">
            <a class="btn" href="${esc(productPageUrl(product))}">Size / Colour chuno</a>
          </div>` : `
          <div class="product-popup-actions">
            <button class="btn popup-add-cart" type="button" ${stock ? '' : 'disabled'}>Add to Cart</button>
            <button class="btn secondary popup-order-now" type="button" ${stock ? '' : 'disabled'}>Order Now</button>
          </div>`}
        </div>
      </div>`;
    document.body.appendChild(overlay);
    MC.initGallery(overlay);
    document.body.style.overflow = 'hidden';
    $('.product-popup-close', overlay)?.addEventListener('click', closePopup);
    overlay.addEventListener('click', event => {
      if (event.target === overlay) closePopup();
    });
    popupKeyHandler = event => {
      if (event.key === 'Escape') closePopup();
    };
    document.addEventListener('keydown', popupKeyHandler);
    const qty = () => safeQuantity($('.popup-qty', overlay)?.value, stock);
    $('.popup-add-cart', overlay)?.addEventListener('click', () => {
      if (qty()) addToCart(product._id, qty());
    });
    $('.popup-order-now', overlay)?.addEventListener('click', () => {
      if (qty()) buyNow(product._id, qty());
    });
  }

  function productCard(product) {
    const stock = stockOf(product);
    const discount = discountOf(product);
    const id = esc(product._id);
    return `
      <article class="premium-product-card">
        <button class="premium-product-open product-card-open" type="button" data-id="${id}">
          <div class="premium-image-wrap">
            <img class="premium-product-img" src="${esc(pictureOf(product))}" alt="${esc(product.name)}" loading="lazy" decoding="async">
            ${discount > 0 ? `<span class="discount-badge">${discount}% OFF</span>` : ''}
            <span class="stock-dot ${stock ? '' : 'out'}"></span>
          </div>
          <div class="premium-card-content">
            <div class="premium-category">${esc(product.category?.name || 'Collection')}</div>
            <h3 class="premium-product-title">${esc(product.name)}</h3>
            ${MC.ratingHtml(product)}
            <div class="premium-price-row">${priceMarkup(product, 'premium')}</div>
            <div class="stock-text ${stock ? '' : 'out'}">${stock ? `In stock (${stock})` : 'Out of stock'}</div>
          </div>
        </button>
        <button type="button" class="mc-wish-toggle mc-wish-card" data-wish-id="${id}" aria-label="Add to wishlist" aria-pressed="false" title="Save to wishlist">♡</button>
        <button type="button" class="mc-share-card" data-share-id="${id}" data-share-name="${esc(product.name)}" aria-label="Share this product" title="Share">⤴</button>
        <div class="premium-card-actions">
          <button class="btn add" type="button" data-id="${id}" ${stock ? '' : 'disabled'}>Add to Cart</button>
          <button class="btn secondary buy" type="button" data-id="${id}" ${stock ? '' : 'disabled'}>Order Now</button>
        </div>
      </article>`;
  }

  function listError(title, retry) {
    return `<div class="products-empty">
      <div class="products-empty-icon">${retry ? '⚠️' : '🛍️'}</div>
      <strong>${esc(title)}</strong>
      <span>${retry ? 'Please check connection and try again.' : 'Search ya filter change karke dobara try karein.'}</span>
      ${retry ? '<button class="mc-product-retry" type="button" id="mcReloadProducts">Try Again</button>' : ''}
    </div>`;
  }

  function fillFilters(params) {
    const search = $('#filterForm [name="q"]');
    const sort = $('#filterForm [name="sort"]');
    if (search) search.value = params.get('q') || '';
    if (sort) sort.value = params.get('sort') || 'newest';
    ['minPrice', 'maxPrice'].forEach(name => {
      const field = $('#filterForm [name="' + name + '"]');
      if (field) field.value = params.get(name) || '';
    });
    const stock = $('#filterForm [name="inStock"]');
    if (stock) stock.checked = params.get('inStock') === 'true';
  }

  async function loadCategories(params) {
    const select = $('#categorySelect');
    if (!select) return;
    try {
      const result = await MC.api('/products/categories');
      const categories = Array.isArray(result.categories) ? result.categories : [];
      select.innerHTML = '<option value="">All Categories</option>' +
        categories.map(category => `<option value="${esc(category._id)}">${esc(category.name)}</option>`).join('');
      select.value = params.get('category') || '';
    } catch (error) {
      console.warn('Category loading:', error?.message);
      // Keep existing options, allowing products to load even when categories fail.
    }
  }

  async function loadProducts() {
    const grid = $('#productGrid');
    if (!grid) return;
    const params = new URLSearchParams(location.search);
    fillFilters(params);
    grid.innerHTML = '<div class="products-empty"><strong>Loading products...</strong></div>';
    // Important: category and product requests are independent.
    void loadCategories(params);
    try {
      const result = await MC.api('/products?' + params.toString());
      productsCache = Array.isArray(result.products) ? result.products : [];
      const count = $('#resultCount');
      const total = Number(result.pagination?.total ?? productsCache.length);
      if (count) count.textContent = `${total} ${total === 1 ? 'product' : 'products'}`;
      const hint = result.didYouMean
        ? `<div class="products-empty" style="grid-column:1/-1;padding:10px 0;text-align:left"><span>Exact match nahi mila. Ye dikha rahe hain: <b>${esc(result.didYouMean)}</b></span></div>`
        : '';
      grid.innerHTML = productsCache.length
        ? hint + productsCache.map(productCard).join('')
        : listError('No products found', false);
      refreshWishlist();
    } catch (error) {
      console.error('Product loading:', error);
      grid.innerHTML = listError('Products load nahi ho pa rahe hain', true);
      $('#mcReloadProducts')?.addEventListener('click', loadProducts);
    }
  }

  // Gives every product page its own title, description, address
  // and Google "Product" data (no ratings are invented).
  function applyProductSeo(product, images, stock) {
    try {
      const name = String(product.name || 'Product');
      const text = String(product.description || '').replace(/\s+/g, ' ').trim();
      const description = (text || `Buy ${name} online from Memora Creations.`).slice(0, 155);
      const pageUrl = 'https://memoracreationscare-code.github.io/memora-creations/frontend/product.html?id=' + encodeURIComponent(product._id);

      document.title = `${name} | Memora Creations`;

      const setMeta = (selector, create, value) => {
        let el = document.head.querySelector(selector);
        if (!el) { el = create(); document.head.appendChild(el); }
        el.setAttribute(el.tagName === 'LINK' ? 'href' : 'content', value);
      };

      setMeta('meta[name="description"]', () => {
        const m = document.createElement('meta'); m.name = 'description'; return m;
      }, description);

      setMeta('link[rel="canonical"]', () => {
        const l = document.createElement('link'); l.rel = 'canonical'; return l;
      }, pageUrl);

      setMeta('meta[property="og:title"]', () => {
        const m = document.createElement('meta'); m.setAttribute('property', 'og:title'); return m;
      }, document.title);

      setMeta('meta[property="og:description"]', () => {
        const m = document.createElement('meta'); m.setAttribute('property', 'og:description'); return m;
      }, description);

      if (images[0]?.url) {
        setMeta('meta[property="og:image"]', () => {
          const m = document.createElement('meta'); m.setAttribute('property', 'og:image'); return m;
        }, images[0].url);
      }

      const price = Number(product.sellingPrice);

      if (price > 0) {
        const data = {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name,
          description,
          image: images.map(image => image.url),
          url: pageUrl,
          brand: { '@type': 'Brand', name: 'Memora Creations' },
          ...(Number(product.ratingCount) > 0 && Number(product.ratingAverage) > 0 ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: Number(product.ratingAverage).toFixed(1),
              reviewCount: Number(product.ratingCount)
            }
          } : {}),
          offers: {
            '@type': 'Offer',
            url: pageUrl,
            priceCurrency: 'INR',
            price: price.toFixed(2),
            availability: stock
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
            itemCondition: 'https://schema.org/NewCondition'
          }
        };

        document.head.querySelector('script[data-mc-product]')?.remove();
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.dataset.mcProduct = '1';
        script.textContent = JSON.stringify(data);
        document.head.appendChild(script);
      }
    } catch (error) {
      // SEO tags must never break the product page.
      console.warn('Product SEO skipped:', error);
    }
  }

  // Small reassurance row under the buy buttons (like big shopping sites).
  async function showTrustBadges(box) {
    try {
      let days = 7;
      let codOn = true;
      let returnsOn = true;

      try {
        const data = await MC.api('/settings');
        days = Number(data.settings?.returnWindowDays) || 7;
        codOn = data.settings?.codEnabled !== false;
        returnsOn = data.settings?.returnsEnabled !== false;
      } catch { /* defaults are fine */ }

      const actions = box.querySelector('.actions');
      if (!actions || box.querySelector('.mc-trust')) return;

      const items = [
        '🔒 Secure online payment',
        returnsOn ? `↩️ ${days}-day return / replacement` : '',
        codOn ? '💵 Cash on delivery available' : '',
        '🚚 Tracked delivery all over India'
      ].filter(Boolean);

      const row = document.createElement('ul');
      row.className = 'mc-trust';
      row.style.cssText =
        'list-style:none;margin:16px 0 0;padding:12px 14px;display:grid;gap:6px;' +
        'background:#fff8ea;border-radius:12px;font-size:13.5px;font-weight:600;color:#5b3a24';
      row.innerHTML = items.map(text => `<li>${esc(text)}</li>`).join('');
      actions.insertAdjacentElement('afterend', row);
    } catch (error) {
      console.warn('Trust badges skipped:', error);
    }
  }

  // "You may also like": other products from the same category.
  async function showRelatedProducts(product, box) {
    try {
      // 1) what other customers really bought together with this product
      let others = [];
      let heading = 'You may also like';
      try {
        const bought = await MC.api('/products/' + encodeURIComponent(product._id) + '/also-bought');
        others = (bought.products || []).slice(0, 4);
        if (others.length) heading = 'Customers also bought';
      } catch (_) { /* fall back to the same category */ }

      // 2) not enough order history yet: same category
      if (!others.length) {
        const categoryId = product.category?._id || product.category;
        if (!categoryId || typeof categoryId !== 'string') return;
        const data = await MC.api('/products?category=' + encodeURIComponent(categoryId) + '&limit=9');
        others = (data.products || [])
          .filter(item => String(item._id) !== String(product._id))
          .slice(0, 4);
      }
      if (!others.length) return;
      const section = document.createElement('section');
      section.className = 'mc-related';
      section.style.cssText = 'margin-top:34px';
      section.innerHTML = `
        <h2 style="margin:0 0 14px">${esc(heading)}</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px">
          ${others.map(item => `
            <a href="product.html?id=${encodeURIComponent(item._id)}"
               style="text-decoration:none;color:inherit;background:#fff;border-radius:14px;
                      padding:10px;box-shadow:0 4px 14px rgba(0,0,0,.07);display:block">
              <img src="${esc(pictureOf(item))}" alt="${esc(item.name)}" loading="lazy"
                   style="width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:10px">
              <div style="margin-top:8px;font-weight:600;font-size:14px">${esc(item.name)}</div>
              <div style="font-size:14px">${priceMarkup(item)}</div>
            </a>`).join('')}
        </div>`;
      box.appendChild(section);
    } catch (error) {
      console.warn('Related products skipped:', error);
    }
  }

  async function loadSingleProduct() {
    const box = $('#product');
    if (!box) return;
    const id = new URLSearchParams(location.search).get('id');
    if (!id) {
      box.innerHTML = '<div class="empty">Product not found.</div>';
      return;
    }
    box.innerHTML = '<div class="empty">Loading product...</div>';
    try {
      const data = await MC.api('/products/' + encodeURIComponent(id));
      const product = data.product;
      if (!product) {
        box.innerHTML = '<div class="empty">Product not found.</div>';
        return;
      }
      const stock = stockOf(product);
      const images = Array.isArray(product.images) ? product.images.filter(x => x?.url) : [];
      box.innerHTML = `
        <div class="two">
          <div class="gallery">
            ${MC.galleryHtml(images, product.name, { thumbs: true })}
          </div>
          <div>
            <span class="pill">${esc(product.category?.name || 'Category')}</span>
            <h1>${esc(product.name)}</h1>
            ${MC.ratingHtml(product)}
            <p>${esc(product.description || '')}</p>
            <div class="price">${priceMarkup(product)}</div>
            ${saleBanner(product)}
            <p>${stock ? (stock <= 5 ? `🔥 Only ${stock} left - order soon` : `✅ In Stock (${stock})`) : '❌ OUT OF STOCK'}</p>
            ${stock ? '' : `
            <form id="notifyForm" novalidate style="margin:12px 0;padding:14px;border:1px solid #eadfce;border-radius:14px;background:#fffaf3">
              <b style="display:block;margin-bottom:8px">🔔 Stock aane par email chahiye?</b>
              <div style="display:flex;gap:8px">
                <input id="notifyEmail" type="email" class="input" placeholder="Aapka email" autocomplete="email" style="flex:1;min-width:0">
                <button class="btn" type="submit">Notify me</button>
              </div>
              <div id="notifyMsg" style="margin-top:8px;font-size:13px" aria-live="polite"></div>
            </form>`}
            ${hasVariants(product) ? `
            <div class="field">
              <label for="variantPick">Option (size / colour)</label>
              <select id="variantPick" class="input">
                <option value="">-- Option chuno --</option>
                ${product.variants.map(v => `<option value="${esc(v._id)}" ${Number(v.stock) > 0 ? '' : 'disabled'}>${esc(v.label)}${Number(v.stock) > 0 ? '' : ' (Out of stock)'}</option>`).join('')}
              </select>
            </div>` : ''}
            <div class="field">
              <label for="qty">Quantity</label>
              <input id="qty" class="input" type="number" min="1" max="${Math.max(1, stock)}" value="1" ${stock ? '' : 'disabled'}>
            </div>
            <div class="actions">
              <button type="button" class="mc-wish-toggle mc-wish-single" data-wish-id="${esc(product._id)}" aria-label="Add to wishlist" aria-pressed="false">♡ Save to Wishlist</button>
              <button class="btn secondary" id="shareBtn" type="button" data-share-id="${esc(product._id)}" data-share-name="${esc(product.name)}">Share</button>
              <button class="btn" id="addBtn" type="button" ${stock ? '' : 'disabled'}>Add to Cart</button>
              <button class="btn secondary" id="buyBtn" type="button" ${stock ? '' : 'disabled'}>Order Now</button>
            </div>
          </div>
        </div>`;
      applyProductSeo(product, images, stock);
      void showTrustBadges(box);
      void showRelatedProducts(product, box);
      window.MCPinCheck?.mount(box, product._id);
      refreshWishlist();
      // FIX: querySelectorAll returns a list; querySelector does not.
      MC.initGallery(box);
      $('#notifyForm')?.addEventListener('submit', async event => {
        event.preventDefault();
        const msg = $('#notifyMsg');
        const email = $('#notifyEmail').value.trim();
        msg.style.color = '#7a6a58';
        msg.textContent = 'Ruko…';
        try {
          const result = await MC.api('/products/' + encodeURIComponent(product._id) + '/notify-me', {
            method: 'POST',
            body: JSON.stringify({ email })
          });
          msg.style.color = '#1f7a4a';
          msg.textContent = result.message || 'Done!';
        } catch (error) {
          msg.style.color = '#b3261e';
          msg.textContent = error?.message || 'Abhi save nahi ho paya. Dobara try karein.';
        }
      });
      // the Share button (data-share-id) is handled by js/share.js
      let chosen = null;
      const stockNow = () => chosen ? Number(chosen.stock) || 0 : stock;
      const quantity = () => safeQuantity($('#qty')?.value, stockNow());
      const needOption = () => {
        if (hasVariants(product) && !chosen) { MC.toast('Pehle option (size / colour) chuno', 'error'); return true; }
        return false;
      };
      $('#variantPick')?.addEventListener('change', event => {
        chosen = product.variants.find(v => String(v._id) === event.target.value) || null;
        const shown = chosen
          ? { sellingPrice: chosen.price ?? product.sellingPrice, originalPrice: chosen.originalPrice ?? product.originalPrice }
          : product;
        const priceBox = $('.price', box);
        if (priceBox) priceBox.innerHTML = priceMarkup(shown);
        const qtyInput = $('#qty');
        if (qtyInput) { qtyInput.max = Math.max(1, stockNow()); qtyInput.value = 1; }
      });
      $('#addBtn')?.addEventListener('click', () => {
        if (needOption()) return;
        if (quantity()) addToCart(product._id, quantity(), chosen?._id);
      });
      $('#buyBtn')?.addEventListener('click', () => {
        if (needOption()) return;
        if (quantity()) buyNow(product._id, quantity(), chosen?._id);
      });
    } catch (error) {
      console.error('Single product loading:', error);
      box.innerHTML = '<div class="empty">Product load nahi ho pa raha hai. <button type="button" id="mcRetrySingle">Try Again</button></div>';
      $('#mcRetrySingle')?.addEventListener('click', loadSingleProduct);
    }
  }

  document.addEventListener('click', event => {
    const open = event.target.closest('.product-card-open[data-id]');
    if (open) {
      const product = productsCache.find(item => String(item._id) === open.dataset.id);
      if (product) openPopup(product);
      return;
    }
    const add = event.target.closest('#productGrid .add[data-id]');
    const buy = event.target.closest('#productGrid .buy[data-id]');
    const picked = add || buy;
    if (picked && !picked.disabled) {
      const item = productsCache.find(p => String(p._id) === picked.dataset.id);
      // Size / colour products need the option chosen on their own page.
      if (hasVariants(item)) { location.href = productPageUrl(item); return; }
      if (add) addToCart(add.dataset.id, 1); else buyNow(buy.dataset.id);
    }
  });

  const filterForm = $('#filterForm');
  if (filterForm && $('#productGrid')) {
    filterForm.addEventListener('submit', event => {
      event.preventDefault();
      const params = new URLSearchParams();
      for (const [key, value] of new FormData(filterForm).entries()) {
        const clean = String(value || '').trim();
        if (clean && !(key === 'sort' && clean === 'newest')) params.set(key, clean);
      }
      const query = params.toString();
      location.href = location.pathname + (query ? '?' + query : '');
    });
  }

  if ($('#productGrid')) loadProducts();
  if ($('#product')) loadSingleProduct();
  if ($('#productGrid') || $('#product')) void loadWishlist();
})();
