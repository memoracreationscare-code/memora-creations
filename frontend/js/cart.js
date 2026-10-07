const CART_BASE =
  '/memora-creations';


let cartUpdating =
  false;


/* =========================
   LOAD CART
========================= */

async function loadCartPage() {

  const user =
    await window.MC.requireLogin();


  if (!user) {
    return;
  }


  const itemsBox =
    window.MC.$(
      '#cartItems'
    );


  const summaryBox =
    window.MC.$(
      '#summary'
    );


  if (
    !itemsBox ||
    !summaryBox
  ) {

    return;

  }


  try {

    const data =
      await window.MC.api(
        '/cart'
      );


    const cart =
      data.cart || {
        items: [],
        subtotal: 0,
        deliveryCharge: 0,
        grandTotal: 0
      };


    const items =
      cart.items || [];


    /* =========================
       ITEMS
    ========================= */

    itemsBox.innerHTML =
      items.length

        ? items
            .map(
              item => {

                const product =
                  item.product || {};


                const stock =
                  Math.max(
                    0,
                    Number(
                      product.stock || 0
                    )
                  );


                const quantity =
                  Math.max(
                    1,
                    Number(
                      item.quantity || 1
                    )
                  );


                const image =
                  product.images?.[0]?.url ||
                  'https://placehold.co/120x120?text=Memora';


                return `

                  <div
                    class="cartrow"
                  >

                    <img
                      src="${window.MC.esc(image)}"
                      alt="${window.MC.esc(product.name || 'Product')}"
                    >


                    <div>

                      <h3>

                        ${window.MC.esc(
                          product.name ||
                          'Product'
                        )}

                      </h3>


                      <div>

                        ${window.MC.money(
                          product.sellingPrice
                        )}

                      </div>


                      <div class="qty">

                        <button
                          class="btn secondary cart-dec"
                          type="button"
                          data-id="${item.id}"
                          ${
                            quantity <= 1
                              ? 'disabled'
                              : ''
                          }
                        >
                          −
                        </button>


                        <span
                          class="cart-qty-value"
                        >
                          ${quantity}
                        </span>


                        <button
                          class="btn secondary cart-inc"
                          type="button"
                          data-id="${item.id}"
                          data-stock="${stock}"
                          ${
                            stock < 1 ||
                            quantity >= stock
                              ? 'disabled'
                              : ''
                          }
                        >
                          +
                        </button>

                      </div>

                    </div>


                    <div>

                      <b>

                        ${window.MC.money(
                          item.lineTotal
                        )}

                      </b>


                      <br><br>


                      <button
                        class="btn danger cart-remove"
                        type="button"
                        data-id="${item.id}"
                      >
                        Remove
                      </button>

                    </div>

                  </div>

                `;

              }
            )
            .join('')

        : `

            <div class="empty">
              Your cart is empty.
            </div>

          `;


    /* =========================
       SUMMARY
    ========================= */

    summaryBox.innerHTML = `

      <div class="summaryline">

        <span>
          Subtotal
        </span>

        <b>
          ${window.MC.money(
            cart.subtotal
          )}
        </b>

      </div>


      <div class="summaryline">

        <span>
          Delivery
        </span>

        <b>
          ${window.MC.money(
            cart.deliveryCharge
          )}
        </b>

      </div>


      <div
        class="summaryline total"
      >

        <span>
          Total
        </span>

        <b>
          ${window.MC.money(
            cart.grandTotal
          )}
        </b>

      </div>


      <button
        class="btn"
        id="checkoutBtn"
        type="button"
        ${
          items.length
            ? ''
            : 'disabled'
        }
      >
        Proceed to Checkout
      </button>

    `;


    /* =========================
       MINUS BUTTON
    ========================= */

    window.MC
      .$$(
        '.cart-dec'
      )
      .forEach(
        button => {

          button.onclick =
            async () => {

              await changeCartQuantity(
                button.dataset.id,
                -1
              );

            };

        }
      );


    /* =========================
       PLUS BUTTON
    ========================= */

    window.MC
      .$$(
        '.cart-inc'
      )
      .forEach(
        button => {

          button.onclick =
            async () => {

              await changeCartQuantity(
                button.dataset.id,
                1,
                Number(
                  button.dataset.stock ||
                  0
                )
              );

            };

        }
      );


    /* =========================
       REMOVE BUTTON
    ========================= */

    window.MC
      .$$(
        '.cart-remove'
      )
      .forEach(
        button => {

          button.onclick =
            async () => {

              await removeCartItem(
                button.dataset.id
              );

            };

        }
      );


    /* =========================
       CHECKOUT BUTTON
    ========================= */

    const checkoutBtn =
      window.MC.$(
        '#checkoutBtn'
      );


    if (checkoutBtn) {

      checkoutBtn.onclick =
        () => {

          location.href =
            CART_BASE +
            '/frontend/checkout.html';

        };

    }


    await window.MC
      .updateCartCount();


  } catch (error) {

    console.error(
      'Cart loading error:',
      error
    );


    itemsBox.innerHTML = `

      <div class="empty">
        Cart load nahi ho pa raha hai.
      </div>

    `;


    summaryBox.innerHTML =
      '';


    window.MC.toast(
      error.message ||
      'Cart load failed.',
      'error'
    );

  }

}


/* =========================
   CHANGE QUANTITY
========================= */

async function changeCartQuantity(
  id,
  delta,
  stock = 0
) {

  if (cartUpdating) {
    return;
  }


  const button =
    document.querySelector(
      `.cart-dec[data-id="${CSS.escape(id)}"], .cart-inc[data-id="${CSS.escape(id)}"]`
    );


  const cartRow =
    button?.closest(
      '.cartrow'
    );


  const quantityBox =
    cartRow?.querySelector(
      '.cart-qty-value'
    );


  const currentQty =
    Math.max(
      1,
      Number(
        quantityBox?.textContent ||
        1
      )
    );


  const newQty =
    currentQty +
    Number(delta || 0);


  if (newQty < 1) {

    return;

  }


  if (
    stock > 0 &&
    newQty > stock
  ) {

    window.MC.toast(
      'Stock limit reached.',
      'error'
    );


    return;

  }


  cartUpdating =
    true;


  try {

    await window.MC.api(
      '/cart/' +
      encodeURIComponent(id),
      {

        method:
          'PUT',

        body:
          JSON.stringify({

            quantity:
              newQty

          })

      }
    );


    await loadCartPage();


  } catch (error) {

    window.MC.toast(
      error.message ||
      'Quantity update failed.',
      'error'
    );


  } finally {

    cartUpdating =
      false;

  }

}


/* =========================
   REMOVE ITEM
========================= */

async function removeCartItem(
  id
) {

  if (cartUpdating) {
    return;
  }


  cartUpdating =
    true;


  try {

    await window.MC.api(
      '/cart/' +
      encodeURIComponent(id),
      {

        method:
          'DELETE'

      }
    );


    window.MC.toast(
      'Product removed from cart.',
      'success'
    );


    await loadCartPage();


  } catch (error) {

    window.MC.toast(
      error.message ||
      'Product remove failed.',
      'error'
    );


  } finally {

    cartUpdating =
      false;

  }

}


/* =========================
   START
========================= */

if (
  window.MC.$(
    '#cartItems'
  )
) {

  loadCartPage();

}
