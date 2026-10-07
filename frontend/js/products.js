const PRODUCTS_BASE =
  '/memora-creations';

let productListCache = [];


/* =========================
   QUANTITY
========================= */

function safeQuantity(
  value,
  stock
) {

  const maxStock =
    Math.max(
      0,
      Number(stock || 0)
    );


  if (maxStock < 1) {
    return 0;
  }


  const quantity =
    Math.max(
      1,
      Number(value || 1)
    );


  return Math.min(
    quantity,
    maxStock
  );

}


/* =========================
   CLOSE PRODUCT POPUP
========================= */

function closeProductPopup() {

  document
    .querySelector(
      '#productQuickView'
    )
    ?.remove();


  document.body.style.overflow =
    '';

}


/* =========================
   OPEN PRODUCT POPUP
========================= */

function openProductPopup(
  product
) {

  closeProductPopup();


  const overlay =
    document.createElement(
      'div'
    );


  overlay.id =
    'productQuickView';


  overlay.className =
    'product-popup-overlay';


  const image =
    product.images?.[0]?.url ||
    'https://placehold.co/600x600?text=Memora';


  const stock =
    Math.max(
      0,
      Number(
        product.stock || 0
      )
    );


  overlay.innerHTML = `

    <div class="product-popup">

      <button
        class="product-popup-close"
        type="button"
        aria-label="Close"
      >
        ×
      </button>


      <div
        class="product-popup-imagebox"
      >

        <img
          src="${window.MC.esc(image)}"
          alt="${window.MC.esc(product.name || '')}"
        >

      </div>


      <div
        class="product-popup-info"
      >

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


        <div
          class="product-popup-price"
        >

          ${window.MC.money(
            product.sellingPrice
          )}

          ${
            Number(
              product.originalPrice
            ) >
            Number(
              product.sellingPrice
            )

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
            stock > 0
              ? `✅ In Stock (${stock})`
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
            max="${Math.max(stock, 1)}"
            value="1"
            ${
              stock < 1
                ? 'disabled'
                : ''
            }
          >

        </div>


        <div
          class="product-popup-actions"
        >

          <button
            class="btn popup-add-cart"
            type="button"
            ${
              stock < 1
                ? 'disabled'
                : ''
            }
          >
            Add to Cart
          </button>


          <button
            class="btn secondary popup-order-now"
            type="button"
            ${
              stock < 1
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


  document.body.appendChild(
    overlay
  );


  document.body.style.overflow =
    'hidden';


  /* CLOSE BUTTON */

  overlay
    .querySelector(
      '.product-popup-close'
    )
    ?.addEventListener(
      'click',
      closeProductPopup
    );


  /* OUTSIDE CLICK */

  overlay.addEventListener(
    'click',
    event => {

      if (
        event.target ===
        overlay
      ) {

        closeProductPopup();

      }

    }
  );


  /* ESCAPE KEY */

  const escapeHandler =
    event => {

      if (
        event.key ===
        'Escape'
      ) {

        closeProductPopup();


        document
          .removeEventListener(
            'keydown',
            escapeHandler
          );

      }

    };


  document.addEventListener(
    'keydown',
    escapeHandler
  );


  /* ADD TO CART */

  overlay
    .querySelector(
      '.popup-add-cart'
    )
    ?.addEventListener(
      'click',
      async () => {

        const qty =
          safeQuantity(
            overlay
              .querySelector(
                '.popup-qty'
              )
              ?.value,
            stock
          );


        if (qty < 1) {
          return;
        }


        await addProductToCart(
          product._id,
          qty
        );

      }
    );


  /* ORDER NOW */

  overlay
    .querySelector(
      '.popup-order-now'
    )
    ?.addEventListener(
      'click',
      () => {

        const qty =
          safeQuantity(
            overlay
              .querySelector(
                '.popup-qty'
              )
              ?.value,
            stock
          );


        if (qty < 1) {
          return;
        }


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


  if (!grid) {
    return;
  }


  const params =
    new URLSearchParams(
      location.search
    );


  try {

    const [
      data,
      categoryData
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
      data.products || [];


    /* CATEGORY */

    const categorySelect =
      window.MC.$(
        '#categorySelect'
      );


    if (categorySelect) {

      categorySelect.innerHTML =
        '<option value="">All Categories</option>' +

        (
          categoryData.categories ||
          []
        )
          .map(
            category => `

              <option
                value="${window.MC.esc(category._id)}"
                ${
                  params.get(
                    'category'
                  ) ===
                  String(
                    category._id
                  )

                    ? 'selected'

                    : ''
                }
              >

                ${window.MC.esc(
                  category.name
                )}

              </option>

            `
          )
          .join('');

    }


    /* SEARCH VALUE */

    const searchInput =
      window.MC.$(
        '#filterForm [name="q"]'
      );


    if (searchInput) {

      searchInput.value =
        params.get('q') ||
        '';

    }


    /* SORT VALUE */

    const sortSelect =
      window.MC.$(
        '#filterForm [name="sort"]'
      );


    if (sortSelect) {

      sortSelect.value =
        params.get('sort') ||
        'newest';

    }


    /* RESULT COUNT */

    const resultCount =
      window.MC.$(
        '#resultCount'
      );


    if (resultCount) {

      const total =
        data.pagination?.total ??
        productListCache.length;


      resultCount.textContent =
        `${total} ${
          total === 1
            ? 'product'
            : 'products'
        }`;

    }


    /* PRODUCT GRID */

    grid.innerHTML =
      productListCache.length

        ? productListCache
            .map(
              product => {

                const stock =
                  Math.max(
                    0,
                    Number(
                      product.stock ||
                      0
                    )
                  );


                return `

                  <article class="card">

                    <button
                      class="product-card-open"
                      type="button"
                      data-id="${product._id}"
                    >

                      <img
                        class="productimg"
                        src="${window.MC.esc(
                          product.images?.[0]?.url ||
                          'https://placehold.co/600x600?text=Memora'
                        )}"
                        alt="${window.MC.esc(
                          product.name || ''
                        )}"
                      >


                      <div
                        class="cardbody"
                      >

                        <span class="pill">

                          ${window.MC.esc(
                            product.category?.name ||
                            'Category'
                          )}

                        </span>


                        <h3>

                          ${window.MC.esc(
                            product.name || ''
                          )}

                        </h3>


                        <div class="price">

                          ${window.MC.money(
                            product.sellingPrice
                          )}

                          ${
                            Number(
                              product.originalPrice
                            ) >
                            Number(
                              product.sellingPrice
                            )

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

                          ${
                            stock > 0
                              ? `In stock (${stock})`
                              : 'Out of stock'
                          }

                        </p>

                      </div>

                    </button>


                    <div
                      class="cardbody actions"
                    >

                      <button
                        class="btn add"
                        type="button"
                        data-id="${product._id}"
                        ${
                          stock < 1
                            ? 'disabled'
                            : ''
                        }
                      >
                        Add to Cart
                      </button>


                      <button
                        class="btn secondary buy"
                        type="button"
                        data-id="${product._id}"
                        ${
                          stock < 1
                            ? 'disabled'
                            : ''
                        }
                      >
                        Order Now
                      </button>

                    </div>

                  </article>

                `;

              }
            )
            .join('')

        : `

            <div class="empty">
              No products found.
            </div>

          `;


    /* OPEN PRODUCT */

    window.MC
      .$$(
        '.product-card-open'
      )
      .forEach(
        button => {

          button.onclick =
            () => {

              const product =
                productListCache
                  .find(
                    item =>
                      String(
                        item._id
                      ) ===
                      String(
                        button.dataset.id
                      )
                  );


              if (product) {

                openProductPopup(
                  product
                );

              }

            };

        }
      );


    /* ADD TO CART */

    window.MC
      .$$('.add')
      .forEach(
        button => {

          button.onclick =
            async () => {

              await addProductToCart(
                button.dataset.id,
                1
              );

            };

        }
      );


    /* BUY NOW */

    window.MC
      .$$('.buy')
      .forEach(
        button => {

          button.onclick =
            () => {

              buyProductNow(
                button.dataset.id
              );

            };

        }
      );


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
              Number(
                quantity || 1
              )

          })

      }
    );


    await window.MC
      .updateCartCount();


    if (
      typeof
        window.MC.showCartPopup ===
      'function'
    ) {

      window.MC
        .showCartPopup();

    } else {

      window.MC.toast(
        'Product cart mein add ho gaya.',
        'success'
      );

    }


  } catch (error) {

    const message =
      String(
        error.message || ''
      )
        .toLowerCase();


    if (
      message.includes(
        'login'
      ) ||
      message.includes(
        'unauthorized'
      ) ||
      message.includes(
        'authentication'
      )
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

function buyProductNow(
  id
) {

  location.href =
    `${PRODUCTS_BASE}/frontend/checkout.html?buyNow=` +
    encodeURIComponent(
      id
    ) +
    '&qty=1';

}


/* =========================
   LOAD SINGLE PRODUCT
========================= */

async function loadSingleProduct() {

  const productBox =
    window.MC.$(
      '#product'
    );


  if (!productBox) {
    return;
  }


  const id =
    new URLSearchParams(
      location.search
    )
      .get('id');


  if (!id) {

    productBox.innerHTML = `

      <div class="empty">
        Product not found.
      </div>

    `;


    return;

  }


  try {

    const data =
      await window.MC.api(
        '/products/' +
        encodeURIComponent(id)
      );


    const product =
      data.product;


    if (!product) {

      productBox.innerHTML = `

        <div class="empty">
          Product not found.
        </div>

      `;


      return;

    }


    const stock =
      Math.max(
        0,
        Number(
          product.stock || 0
        )
      );


    const images =
      product.images || [];


    productBox.innerHTML = `

      <div class="two">

        <div class="gallery">

          <div class="thumbs">

            ${
              images.length

                ? images
                    .map(
                      image => `

                        <img
                          src="${window.MC.esc(image.url)}"
                          data-url="${window.MC.esc(image.url)}"
                          alt="${window.MC.esc(product.name || '')}"
                        >

                      `
                    )
                    .join('')

                : ''
            }

          </div>


          <img
            class="mainimage"
            id="mainImage"
            src="${window.MC.esc(
              product.images?.[0]?.url ||
              'https://placehold.co/800x800?text=Memora'
            )}"
            alt="${window.MC.esc(
              product.name || ''
            )}"
          >

        </div>


        <div>

          <span class="pill">

            ${window.MC.esc(
              product.category?.name ||
              'Category'
            )}

          </span>


          <h1>

            ${window.MC.esc(
              product.name || ''
            )}

          </h1>


          <p>

            ${window.MC.esc(
              product.description ||
              ''
            )}

          </p>


          <div class="price">

            ${window.MC.money(
              product.sellingPrice
            )}

            ${
              Number(
                product.originalPrice
              ) >
              Number(
                product.sellingPrice
              )

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


          <p>

            ${
              stock > 0
                ? `✅ In Stock (${stock})`
                : '❌ OUT OF STOCK'
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
              max="${Math.max(stock, 1)}"
              value="1"
              ${
                stock < 1
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
                stock < 1
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
                stock < 1
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


    /* IMAGE THUMBNAILS */

    window.MC
      .$$('.thumbs img')
      .forEach(
        image => {

          image.onclick =
            () => {

              const mainImage =
                window.MC.$(
                  '#mainImage'
                );


              if (mainImage) {

                mainImage.src =
                  image.dataset.url;

              }

            };

        }
      );


    /* ADD */

    const addBtn =
      window.MC.$(
        '#addBtn'
      );


    if (addBtn) {

      addBtn.onclick =
        async () => {

          const qty =
            safeQuantity(
              window.MC.$(
                '#qty'
              )?.value,
              stock
            );


          if (qty < 1) {
            return;
          }


          await addProductToCart(
            product._id,
            qty
          );

        };

    }


    /* BUY */

    const buyBtn =
      window.MC.$(
        '#buyBtn'
      );


    if (buyBtn) {

      buyBtn.onclick =
        () => {

          const qty =
            safeQuantity(
              window.MC.$(
                '#qty'
              )?.value,
              stock
            );


          if (qty < 1) {
            return;
          }


          location.href =
            `${PRODUCTS_BASE}/frontend/checkout.html?buyNow=${encodeURIComponent(product._id)}&qty=${encodeURIComponent(qty)}`;

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
   PRODUCT LIST PAGE START
========================= */

if (
  window.MC.$(
    '#productGrid'
  )
) {

  const filterForm =
    window.MC.$(
      '#filterForm'
    );


  if (filterForm) {

    filterForm.addEventListener(
      'submit',
      event => {

        event.preventDefault();


        const formData =
          new FormData(
            event.currentTarget
          );


        const params =
          new URLSearchParams();


        for (
          const [
            key,
            value
          ] of formData.entries()
        ) {

          const cleanValue =
            String(
              value || ''
            )
              .trim();


          if (
            cleanValue &&
            !(
              key === 'sort' &&
              cleanValue ===
              'newest'
            )
          ) {

            params.set(
              key,
              cleanValue
            );

          }

        }


        const query =
          params.toString();


        location.href =
          `${location.pathname}${
            query
              ? '?' + query
              : ''
          }`;

      }
    );

  }


  loadProducts();

}


/* =========================
   SINGLE PRODUCT PAGE START
========================= */

if (
  window.MC.$(
    '#product'
  )
) {

  loadSingleProduct();

}
