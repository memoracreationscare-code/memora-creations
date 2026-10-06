const {
  api,
  $,
  $$,
  money,
  esc,
  toast,
  updateCartCount
} = window.MC;

const BASE = '/memora-creations';

/* =========================
   LOAD ALL PRODUCTS
========================= */

async function loadProducts() {
  const grid = $('#productGrid');

  if (!grid) return;

  const params = new URLSearchParams(location.search);

  try {
    const [d, cats] = await Promise.all([
      api('/products?' + params.toString()),
      api('/products/categories')
    ]);

    /* Categories */
    if ($('#categorySelect')) {
      $('#categorySelect').innerHTML =
        '<option value="">All Categories</option>' +
        cats.categories
          .map(
            c => `
              <option
                value="${c._id}"
                ${
                  params.get('category') === String(c._id)
                    ? 'selected'
                    : ''
                }
              >
                ${esc(c.name)}
              </option>
            `
          )
          .join('');
    }

    /* Product count */
    if ($('#resultCount')) {
      $('#resultCount').textContent =
        `${d.pagination.total} products`;
    }

    /* Products */
    grid.innerHTML = d.products.length
      ? d.products
          .map(
            p => `
              <article class="card">

                <a href="${BASE}/frontend/product.html?id=${p._id}">

                  <img
                    class="productimg"
                    src="${esc(
                      p.images?.[0]?.url ||
                      'https://placehold.co/600x600?text=Memora'
                    )}"
                    alt="${esc(p.name)}"
                  >

                  <div class="cardbody">

                    <span class="pill">
                      ${esc(p.category?.name || 'Category')}
                    </span>

                    <h3>${esc(p.name)}</h3>

                    <div class="price">
                      ${money(p.sellingPrice)}

                      <span class="old">
                        ${money(p.originalPrice)}
                      </span>
                    </div>

                    <p class="muted">
                      ${
                        p.stock > 0
                          ? 'In stock'
                          : 'Out of stock'
                      }
                    </p>

                  </div>

                </a>

                <div class="cardbody">

                  <button
                    class="btn add"
                    data-id="${p._id}"
                    ${p.stock < 1 ? 'disabled' : ''}
                  >
                    Add to Cart
                  </button>

                  <button
                    class="btn secondary buy"
                    data-id="${p._id}"
                    ${p.stock < 1 ? 'disabled' : ''}
                  >
                    Buy Now
                  </button>

                </div>

              </article>
            `
          )
          .join('')
      : `
          <div class="empty">
            No products found.
          </div>
        `;

    $$('.add').forEach(button => {
      button.onclick = () => add(button.dataset.id);
    });

    $$('.buy').forEach(button => {
      button.onclick = () => buy(button.dataset.id);
    });

  } catch (error) {
    console.error(error);

    grid.innerHTML = `
      <div class="empty">
        Products load nahi ho pa rahe hain.
      </div>
    `;

    toast(error.message || 'Products load failed.', 'error');
  }
}


/* =========================
   ADD TO CART
========================= */

async function add(id) {
  try {

    await api('/cart', {
      method: 'POST',
      body: JSON.stringify({
        productId: id,
        quantity: 1
      })
    });

    toast('Product cart mein add ho gaya.', 'success');

    updateCartCount();

  } catch (e) {

    if (
      e.message.toLowerCase().includes('login') ||
      e.message.toLowerCase().includes('unauthorized')
    ) {
      location.href =
        `${BASE}/frontend/login.html?next=` +
        encodeURIComponent(location.pathname + location.search);

      return;
    }

    toast(e.message, 'error');
  }
}


/* =========================
   BUY NOW
========================= */

function buy(id) {
  location.href =
    `${BASE}/frontend/checkout.html?buyNow=` +
    encodeURIComponent(id) +
    '&qty=1';
}


/* =========================
   SINGLE PRODUCT PAGE
========================= */

async function product() {

  const id =
    new URLSearchParams(location.search).get('id');

  if (!id) return;

  const d =
    await api('/products/' + encodeURIComponent(id));

  const p = d.product;

  $('#product').innerHTML = `

    <div class="two">

      <div class="gallery">

        <div class="thumbs">

          ${(p.images || [])
            .map(
              im => `
                <img
                  src="${esc(im.url)}"
                  data-url="${esc(im.url)}"
                  alt="${esc(p.name)}"
                >
              `
            )
            .join('')}

        </div>

        <img
          class="mainimage"
          id="mainImage"
          src="${esc(
            p.images?.[0]?.url ||
            'https://placehold.co/800x800?text=Memora'
          )}"
          alt="${esc(p.name)}"
        >

      </div>


      <div>

        <span class="pill">
          ${esc(p.category?.name || 'Category')}
        </span>

        <h1>
          ${esc(p.name)}
        </h1>

        <p>
          ${esc(p.description)}
        </p>

        <div class="price">

          ${money(p.sellingPrice)}

          <span class="old">
            ${money(p.originalPrice)}
          </span>

        </div>

        <p>
          ${
            p.stock > 0
              ? `Stock: ${p.stock}`
              : 'OUT OF STOCK'
          }
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
            ${p.stock < 1 ? 'disabled' : ''}
          >
            Add to Cart
          </button>

          <button
            class="btn secondary"
            id="buyBtn"
            ${p.stock < 1 ? 'disabled' : ''}
          >
            Buy Now
          </button>

        </div>

      </div>

    </div>
  `;


  /* Thumbnail images */

  $$('.thumbs img').forEach(img => {

    img.onclick = () => {
      $('#mainImage').src = img.dataset.url;
    };

  });


  /* Full screen image */

  $('#mainImage').onclick = () => {

    const overlay =
      document.createElement('div');

    overlay.className = 'lightbox';

    overlay.innerHTML = `
      <img
        src="${esc($('#mainImage').src)}"
        alt="${esc(p.name)}"
      >

      <button class="btn">
        Close
      </button>
    `;

    overlay.onclick = e => {

      if (
        e.target === overlay ||
        e.target.tagName === 'BUTTON'
      ) {
        overlay.remove();
      }

    };

    document.body.appendChild(overlay);
  };


  /* Add product to cart */

  $('#addBtn').onclick = async () => {

    try {

      await api('/cart', {
        method: 'POST',
        body: JSON.stringify({
          productId: p._id,
          quantity: Number($('#qty').value)
        })
      });

      toast(
        'Product cart mein add ho gaya.',
        'success'
      );

      updateCartCount();

    } catch (e) {

      if (
        e.message.toLowerCase().includes('login') ||
        e.message.toLowerCase().includes('unauthorized')
      ) {
        location.href =
          `${BASE}/frontend/login.html?next=` +
          encodeURIComponent(location.pathname + location.search);

        return;
      }

      toast(e.message, 'error');
    }

  };


  /* Buy now */

  $('#buyBtn').onclick = () => {

    location.href =
      `${BASE}/frontend/checkout.html?buyNow=` +
      encodeURIComponent(p._id) +
      '&qty=' +
      encodeURIComponent(
        Number($('#qty').value)
      );

  };
}


/* =========================
   PAGE START
========================= */

if ($('#productGrid')) {

  loadProducts();

  $('#filterForm')?.addEventListener(
    'submit',
    e => {

      e.preventDefault();

      const params =
        new URLSearchParams(
          new FormData(e.currentTarget)
        );

      location.search =
        params.toString();

    }
  );
}


if ($('#product')) {

  product().catch(e => {

    console.error(e);

    toast(
      e.message || 'Product load failed.',
      'error'
    );

  });

}
