const PRODUCTS_BASE = '/memora-creations';

let productListCache = [];


/* =========================
   PRODUCT POPUP
========================= */

function closeProductPopup() {

  document
    .querySelector('#productQuickView')
    ?.remove();

  document.body.style.overflow = '';
}


function openProductPopup(product) {

  closeProductPopup();

  const overlay =
    document.createElement('div');

  overlay.id =
    'productQuickView';

  overlay.className =
    'product-popup-overlay';


  const image =
    product.images?.[0]?.url ||
    'https://placehold.co/600x600?text=Memora';


  overlay.innerHTML = `

    <div class="product-popup">

      <button
        class="product-popup-close"
        type="button"
        aria-label="Close"
      >
        ×
      </button>


      <div class="product-popup-imagebox">

        <img
          src="${window.MC.esc(image)}"
          alt="${window.MC.esc(product.name)}"
        >

      </div>


      <div class="product-popup-info">

        <span class="pill">

          ${window.MC.esc(
            product.category?.name ||
            'Category'
          )}

        </span>


        <h2>

          ${window.MC.esc(
            product.name || ''
          )}

        </h2>


        <div class="product-popup-price">

          ${window.MC.money(
            product.sellingPrice
          )}

          ${
            Number(product.originalPrice) >
            Number(product.sellingPrice)

              ? `
                <span class="old">

                  ${window.MC.money(
                    product.originalPrice
                  )}

                </span>
              `

              : ''
          }

        </div>


        <p class="muted">

          ${window.MC.esc(
            product.description || ''
          )}

        </p>


        <p>

          ${
            Number(product.stock) > 0
              ? `✅ In Stock (${Number(product.stock)})`
              : '❌ Out of Stock'
          }

        </p>


        <div class="field">

          <label>
            Quantity
          </label>

          <input
            class="input popup-qty"
            type="number"
            min="1"
            max="${Number(product.stock || 1)}"
            value="1"
            ${Number(product.stock) < 1 ? 'disabled' : ''}
          >

        </div>


        <div class="product-popup-actions">

          <button
            class="btn popup-add-cart"
            type="button"
            ${Number(product.stock) < 1 ? 'disabled' : ''}
          >
            Add to Cart
          </button>


          <button
            class="btn secondary popup-order-now"
            type="button"
            ${Number(product.stock) < 1 ? 'disabled' : ''}
          >
            Order Now
          </button>

        </div>

      </div>

    </div>

  `;


  document.body.appendChild(
    overlay
  );

  document.body.style.overflow =
    'hidden';


  overlay
    .querySelector(
      '.product-popup-close'
    )
    ?.addEventListener(
      'click',
      closeProductPopup
    );


  overlay.addEventListener(
    'click',
    event => {

      if (
        event.target === overlay
      ) {

        closeProductPopup();

      }

    }
  );


  document.addEventListener(
    'keydown',
    function escapeHandler(event) {

      if (
        event.key === 'Escape'
      ) {

        closeProductPopup();

        document.removeEventListener(
          'keydown',
          escapeHandler
        );

      }

    }
  );


  overlay
    .querySelector(
      '.popup-add-cart'
    )
    ?.addEventListener(
      'click',
      async () => {

        const qty =
          Math.max(
            1,
            Number(
              overlay
                .querySelector('.popup-qty')
                ?.value || 1
            )
          );


        await addProductToCart(
          product._id,
          qty
        );

      }
    );


  overlay
    .querySelector(
      '.popup-order-now'
    )
    ?.addEventListener(
      'click',
      () => {

        const qty =
          Math.max(
            1,
            Number(
              overlay
                .querySelector('.popup-qty')
                ?.value || 1
            )
          );


        location.href =
          `${PRODUCTS_BASE}/frontend/checkout.html?buyNow=${encodeURIComponent(product._id)}&qty=${encodeURIComponent(qty)}`;

      }
    );

}


/* =========================
   LOAD ALL PRODUCTS
========================= */

async function loadProducts() {

  const grid =
    window.MC.$(
      '#productGrid'
    );


  if (!grid) return;


  const params =
    new URLSearchParams(
      location.search
    );


  try {

    const [
      d,
      cats
    ] =
      await Promise.all([

        window.MC.api(
          '/products?' +
          params.toString()
        ),

        window.MC.api(
          '/products/categories'
        )

      ]);


    productListCache =
      d.products || [];


    const categorySelect =
      window.MC.$(
        '#categorySelect'
      );


    if (categorySelect) {

      categorySelect.innerHTML =
        '<option value="">All Categories</option>' +

        (cats.categories || [])
          .map(c => `

            <option
              value="${c._id}"
              ${
                params.get('category') ===
                String(c._id)
                  ? 'selected'
                  : ''
              }
            >

              ${window.MC.esc(c.name)}

            </option>

          `)
          .join('');

    }


    const resultCount =
      window.MC.$(
        '#resultCount'
      );


    if (resultCount) {

      resultCount.textContent =
        `${
          d.pagination?.total ??
          productListCache.length
        } products`;

    }


    grid.innerHTML =
      productListCache.length

        ? productListCache
            .map(p => `

              <article class="card">

                <button
                  class="product-card-open"
                  type="button"
                  data-id="${p._id}"
                >

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

                      ${window.MC.esc(
                        p.category?.name ||
                        'Category'
                      )}

                    </span>


                    <h3>

                      ${window.MC.esc(
                        p.name
                      )}

                    </h3>


                    <div class="price">

                      ${window.MC.money(
                        p.sellingPrice
                      )}

                      ${
                        Number(p.originalPrice) >
                        Number(p.sellingPrice)

                          ? `
                            <span class="old">

                              ${window.MC.money(
                                p.originalPrice
                              )}

                            </span>
                          `

                          : ''
                      }

                    </div>


                    <p class="muted">

                      ${
                        p.stock > 0
                          ? 'In stock'
                          : 'Out of stock'
                      }

                    </p>

                  </div>

                </button>


                <div class="cardbody actions">

                  <button
                    class="btn add"
                    type="button"
                    data-id="${p._id}"
                    ${
                      p.stock < 1
                        ? 'disabled'
                        : ''
                    }
                  >
                    Add to Cart
                  </button>


                  <button
                    class="btn secondary buy"
                    type="button"
                    data-id="${p._id}"
                    ${
                      p.stock < 1
                        ? 'disabled'
                        : ''
                    }
                  >
                    Order Now
                  </button>

                </div>

              </article>

            `)
            .join('')

        : `
            <div class="empty">
              No products found.
            </div>
          `;


    window.MC
      .$$('.product-card-open')
      .forEach(button => {

        button.onclick = () => {

          const product =
            productListCache.find(
              p =>
                p._id ===
                button.dataset.id
            );


          if (product) {

            openProductPopup(
              product
            );

          }

        };

      });


    window.MC
      .$$('.add')
      .forEach(button => {

        button.onclick = () =>
          addProductToCart(
            button.dataset.id,
            1
          );

      });


    window.MC
      .$$('.buy')
      .forEach(button => {

        button.onclick = () =>
          buyProductNow(
            button.dataset.id
          );

      });


  } catch (error) {

    console.error(
      'Product loading error:',
      error
    );


    grid.innerHTML = `

      <div class="empty">
        Products load nahi ho pa rahe hain.
      </div>

    `;


    window.MC.toast(
      error.message ||
      'Products load failed.',
      'error'
    );

  }

}


/* =========================
   ADD TO CART
========================= */

async function addProductToCart(
  id,
  quantity = 1
) {

  try {

    await window.MC.api(
      '/cart',
      {

        method:
          'POST',

        body:
          JSON.stringify({

            productId:
              id,

            quantity:
              quantity

          })

      }
    );


    window.MC.toast(
      'Product cart mein add ho gaya.',
      'success'
    );


    window.MC.updateCartCount();


  } catch (error) {

    const message =
      String(
        error.message || ''
      ).toLowerCase();


    if (
      message.includes('login') ||
      message.includes('unauthorized') ||
      message.includes('authentication')
    ) {

      location.href =
        `${PRODUCTS_BASE}/frontend/login.html?next=` +
        encodeURIComponent(
          location.pathname +
          location.search
        );

      return;

    }


    window.MC.toast(
      error.message ||
      'Cart update failed.',
      'error'
    );

  }

}


/* =========================
   ORDER NOW
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

  const productBox =
    window.MC.$(
      '#product'
    );


  if (!productBox) return;


  const id =
    new URLSearchParams(
      location.search
    ).get('id');


  if (!id) {

    productBox.innerHTML =
      '<div class="empty">Product not found.</div>';

    return;

  }


  try {

    const d =
      await window.MC.api(
        '/products/' +
        encodeURIComponent(id)
      );


    const p =
      d.product;


    productBox.innerHTML = `

      <div class="two">

        <div class="gallery">

          <div class="thumbs">

            ${(p.images || [])
              .map(im => `

                <img
                  src="${window.MC.esc(im.url)}"
                  data-url="${window.MC.esc(im.url)}"
                  alt="${window.MC.esc(p.name)}"
                >

              `)
              .join('')}

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

            ${window.MC.esc(
              p.category?.name ||
              'Category'
            )}

          </span>


          <h1>
            ${window.MC.esc(p.name)}
          </h1>


          <p>
            ${window.MC.esc(
              p.description
            )}
          </p>


          <div class="price">

            ${window.MC.money(
              p.sellingPrice
            )}

            ${
              Number(p.originalPrice) >
              Number(p.sellingPrice)

                ? `
                  <span class="old">

                    ${window.MC.money(
                      p.originalPrice
                    )}

                  </span>
                `

                : ''
            }

          </div>


          <p>

            ${
              p.stock > 0
                ? `Stock: ${p.stock}`
                : 'OUT OF STOCK'
            }

          </p>


          <div class="field">

            <label>
              Quantity
            </label>

            <input
              id="qty"
              class="input"
              type="number"
              min="1"
              max="${p.stock}"
              value="1"
              ${
                p.stock < 1
                  ? 'disabled'
                  : ''
              }
            >

          </div>


          <div class="actions">

            <button
              class="btn"
              id="addBtn"
              type="button"
              ${
                p.stock < 1
                  ? 'disabled'
                  : ''
              }
            >
              Add to Cart
            </button>


            <button
              class="btn secondary"
              id="buyBtn"
              type="button"
              ${
                p.stock < 1
                  ? 'disabled'
                  : ''
              }
            >
              Order Now
            </button>

          </div>

        </div>

      </div>

    `;


    window.MC
      .$$('.thumbs img')
      .forEach(img => {

        img.onclick = () => {

          window.MC.$(
            '#mainImage'
          ).src =
            img.dataset.url;

        };

      });


    const addBtn =
      window.MC.$(
        '#addBtn'
      );


    if (addBtn) {

      addBtn.onclick =
        async () => {

          const qty =
            Math.max(
              1,
              Number(
                window.MC.$(
                  '#qty'
                )?.value || 1
              )
            );


          await addProductToCart(
            p._id,
            qty
          );

        };

    }


    const buyBtn =
      window.MC.$(
        '#buyBtn'
      );


    if (buyBtn) {

      buyBtn.onclick =
        () => {

          const qty =
            Math.max(
              1,
              Number(
                window.MC.$(
                  '#qty'
                )?.value || 1
              )
            );


          location.href =
            `${PRODUCTS_BASE}/frontend/checkout.html?buyNow=${encodeURIComponent(p._id)}&qty=${encodeURIComponent(qty)}`;

        };

    }


  } catch (error) {

    console.error(
      'Single product error:',
      error
    );


    productBox.innerHTML = `

      <div class="empty">
        Product load nahi ho pa raha hai.
      </div>

    `;


    window.MC.toast(
      error.message ||
      'Product load failed.',
      'error'
    );

  }

}


/* =========================
   PAGE START
========================= */

if (
  window.MC.$(
    '#productGrid'
  )
) {

  loadProducts();


  const filterForm =
    window.MC.$(
      '#filterForm'
    );


  if (filterForm) {

    filterForm.addEventListener(
      'submit',
      event => {

        event.preventDefault();


        const params =
          new URLSearchParams(
            new FormData(
              event.currentTarget
            )
          );


        location.search =
          params.toString();

      }
    );

  }

}


if (
  window.MC.$(
    '#product'
  )
) {

  loadSingleProduct();

}
