const PRODUCTS_BASE = '/memora-creations';

/* =========================
   LOAD ALL PRODUCTS
========================= */

async function loadProducts() {
  const grid = window.MC.$('#productGrid');

  if (!grid) return;

  const params = new URLSearchParams(location.search);

  try {
    const [d, cats] = await Promise.all([
      window.MC.api('/products?' + params.toString()),
      window.MC.api('/products/categories')
    ]);

    const categorySelect = window.MC.$('#categorySelect');

    if (categorySelect) {
      categorySelect.innerHTML =
        '<option value="">All Categories</option>' +
        (cats.categories || [])
          .map(c => `
            <option
              value="${c._id}"
              ${params.get('category') === String(c._id) ? 'selected' : ''}
            >
              ${window.MC.esc(c.name)}
            </option>
          `)
          .join('');
    }

    const resultCount = window.MC.$('#resultCount');

    if (resultCount) {
      resultCount.textContent =
        `${d.pagination?.total ?? d.products?.length ?? 0} products`;
    }

    const products = d.products || [];

    grid.innerHTML = products.length
      ? products.map(p => `
          <article class="card">

            <a href="${PRODUCTS_BASE}/frontend/product.html?id=${encodeURIComponent(p._id)}">

              <img
                class="productimg"
                src="${window.MC.esc(
                  p.images?.[0]?.url ||
                  'https://placehold.co/600x600?text=Memora'
                )}"
                alt="${window.MC.esc(p.name)}"
              >

              <div class="cardbody">

                <span class="pill">
                  ${window.MC.esc(p.category?.name || 'Category')}
                </span>

                <h3>${window.MC.esc(p.name)}</h3>

                <div class="price">
                  ${window.MC.money(p.sellingPrice)}

                  ${
                    Number(p.originalPrice) > Number(p.sellingPrice)
                      ? `<span class="old">${window.MC.money(p.originalPrice)}</span>`
                      : ''
                  }
                </div>

                <p class="muted">
                  ${p.stock > 0 ? 'In stock' : 'Out of stock'}
                </p>

              </div>
            </a>

            <div class="cardbody actions">

              <button
                class="btn add"
                type="button"
                data-id="${p._id}"
                ${p.stock < 1 ? 'disabled' : ''}
              >
                Add to Cart
              </button>

              <button
                class="btn secondary buy"
                type="button"
                data-id="${p._id}"
                ${p.stock < 1 ? 'disabled' : ''}
              >
                Buy Now
              </button>

            </div>

          </article>
        `).join('')
      : `
          <div class="empty">
            No products found.
          </div>
        `;

    window.MC.$$('.add').forEach(button => {
      button.onclick = () => addProductToCart(button.dataset.id);
    });

    window.MC.$$('.buy').forEach(button => {
      button.onclick = () => buyProductNow(button.dataset.id);
    });

  } catch (error) {
    console.error('Product loading error:', error);

    grid.innerHTML = `
      <div class="empty">
        Products load nahi ho pa rahe hain.
      </div>
    `;

    window.MC.toast(
      error.message || 'Products load failed.',
      'error'
    );
  }
}


/* =========================
   ADD TO CART
========================= */

async function addProductToCart(id) {
  try {
    await window.MC.api('/cart', {
      method: 'POST',
      body: JSON.stringify({
        productId: id,
        quantity: 1
      })
    });

    window.MC.toast(
      'Product cart mein add ho gaya.',
      'success'
    );

    window.MC.updateCartCount();

  } catch (error) {
    const message =
      String(error.message || '').toLowerCase();

    if (
      message.includes('login') ||
      message.includes('unauthorized') ||
      message.includes('authentication')
    ) {
      location.href =
        `${PRODUCTS_BASE}/frontend/login.html?next=` +
        encodeURIComponent(
          location.pathname + location.search
        );

      return;
    }

    window.MC.toast(
      error.message || 'Cart update failed.',
      'error'
    );
  }
}


/* =========================
   BUY NOW
========================= */

function buyProductNow(id) {
  location.href =
    `${PRODUCTS_BASE}/frontend/checkout.html?buyNow=` +
    encodeURIComponent(id) +
    '&qty=1';
}


/* =========================
   SINGLE PRODUCT PAGE
========================= */

async function loadSingleProduct() {
  const productBox = window.MC.$('#product');

  if (!productBox) return;

  const id =
    new URLSearchParams(location.search).get('id');

  if (!id) {
    productBox.innerHTML =
      '<div class="empty">Product not found.</div>';
    return;
  }

  try {
    const d = await window.MC.api(
      '/products/' + encodeURIComponent(id)
    );

    const p = d.product;

    productBox.innerHTML = `
      <div class="two">

        <div class="gallery">

          <div class="thumbs">
            ${(p.images || []).map(im => `
              <img
                src="${window.MC.esc(im.url)}"
                data-url="${window.MC.esc(im.url)}"
                alt="${window.MC.esc(p.name)}"
              >
            `).join('')}
          </div>

          <img
            class="mainimage"
            id="mainImage"
            src="${window.MC.esc(
              p.images?.[0]?.url ||
              'https://placehold.co/800x800?text=Memora'
            )}"
            alt="${window.MC.esc(p.name)}"
          >

        </div>

        <div>

          <span class="pill">
            ${window.MC.esc(p.category?.name || 'Category')}
          </span>

          <h1>${window.MC.esc(p.name)}</h1>

          <p>${window.MC.esc(p.description)}</p>

          <div class="price">
            ${window.MC.money(p.sellingPrice)}

            ${
              Number(p.originalPrice) > Number(p.sellingPrice)
                ? `<span class="old">${window.MC.money(p.originalPrice)}</span>`
                : ''
            }
          </div>

          <p>
            ${p.stock > 0 ? `Stock: ${p.stock}` : 'OUT OF STOCK'}
          </p>

          <div class="field">
            <label>Quantity</label>

            <input
              id="qty"
              class="input"
              type="number"
              min="1"
              max="${p.stock}"
              value="1"
              ${p.stock < 1 ? 'disabled' : ''}
            >
          </div>

          <div class="actions">

            <button
              class="btn"
              id="addBtn"
              type="button"
              ${p.stock < 1 ? 'disabled' : ''}
            >
              Add to Cart
            </button>

            <button
              class="btn secondary"
              id="buyBtn"
              type="button"
              ${p.stock < 1 ? 'disabled' : ''}
            >
              Buy Now
            </button>

          </div>

        </div>

      </div>
    `;

    window.MC.$$('.thumbs img').forEach(img => {
      img.onclick = () => {
        window.MC.$('#mainImage').src = img.dataset.url;
      };
    });

    const mainImage = window.MC.$('#mainImage');

    if (mainImage) {
      mainImage.onclick = () => {
        const overlay = document.createElement('div');

        overlay.className = 'lightbox';

        overlay.innerHTML = `
          <img
            src="${window.MC.esc(mainImage.src)}"
            alt="${window.MC.esc(p.name)}"
          >
          <button class="btn" type="button">Close</button>
        `;

        overlay.onclick = event => {
          if (
            event.target === overlay ||
            event.target.tagName === 'BUTTON'
          ) {
            overlay.remove();
          }
        };

        document.body.appendChild(overlay);
      };
    }

    const addBtn = window.MC.$('#addBtn');

    if (addBtn) {
      addBtn.onclick = async () => {
        const qty =
          Math.max(
            1,
            Number(window.MC.$('#qty')?.value || 1)
          );

        try {
          await window.MC.api('/cart', {
            method: 'POST',
            body: JSON.stringify({
              productId: p._id,
              quantity: qty
            })
          });

          window.MC.toast(
            'Product cart mein add ho gaya.',
            'success'
          );

          window.MC.updateCartCount();

        } catch (error) {
          const message =
            String(error.message || '').toLowerCase();

          if (
            message.includes('login') ||
            message.includes('unauthorized') ||
            message.includes('authentication')
          ) {
            location.href =
              `${PRODUCTS_BASE}/frontend/login.html?next=` +
              encodeURIComponent(
                location.pathname + location.search
              );

            return;
          }

          window.MC.toast(
            error.message || 'Cart update failed.',
            'error'
          );
        }
      };
    }

    const buyBtn = window.MC.$('#buyBtn');

    if (buyBtn) {
      buyBtn.onclick = () => {
        const qty =
          Math.max(
            1,
            Number(window.MC.$('#qty')?.value || 1)
          );

        location.href =
          `${PRODUCTS_BASE}/frontend/checkout.html?buyNow=` +
          encodeURIComponent(p._id) +
          '&qty=' +
          encodeURIComponent(qty);
      };
    }

  } catch (error) {
    console.error('Single product error:', error);

    productBox.innerHTML = `
      <div class="empty">
        Product load nahi ho pa raha hai.
      </div>
    `;

    window.MC.toast(
      error.message || 'Product load failed.',
      'error'
    );
  }
}


/* =========================
   PAGE START
========================= */

if (window.MC.$('#productGrid')) {
  loadProducts();

  const filterForm =
    window.MC.$('#filterForm');

  if (filterForm) {
    filterForm.addEventListener(
      'submit',
      event => {
        event.preventDefault();

        const params =
          new URLSearchParams(
            new FormData(event.currentTarget)
          );

        location.search = params.toString();
      }
    );
  }
}


if (window.MC.$('#product')) {
  loadSingleProduct();
}
