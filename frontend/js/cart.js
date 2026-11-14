const CART_BASE =
  '';


let cartUpdating =
  false;

// Quantity changes show on screen at once and are sent to the
// server after a short pause (one request, however many clicks).
const qtyTimers = new Map();
const qtyPending = new Set();
let cartUser = null;


/* =========================
   LOAD CART
========================= */

async function loadCartPage() {

  // Ask the server who is logged in only once per page visit.
  const user =
    cartUser ||
    await window.MC.requireLogin();

  cartUser = user || null;


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
                    data-price="${Number(product.sellingPrice || 0)}"
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

                      ${(item.customPhotos && item.customPhotos.length) ? `
                      <div class="cart-custom" style="margin:8px 0">
                        <div style="font-size:12px;font-weight:800;color:#7a4b2a;margin-bottom:5px">📷 Aapki photo${item.customPhotos.length > 1 ? 's' : ''}</div>
                        <div style="display:flex;gap:6px;flex-wrap:wrap">
                          ${item.customPhotos.map(p => `<img src="${window.MC.esc(p.url)}" alt="Aapki photo" style="width:44px;height:44px;border-radius:8px;object-fit:cover">`).join('')}
                        </div>
                        ${item.customNote ? `<div style="font-size:12px;color:#6b5d52;margin-top:5px">📝 ${window.MC.esc(item.customNote)}</div>` : ''}
                      </div>` : ''}


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

                      <b class="cart-line-total">

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

      <div class="mc-freeship" data-subtotal="${Number(cart.subtotal) || 0}" hidden></div>

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

    if (typeof window.mcApplyFreeShip === 'function') {
      window.mcApplyFreeShip();
    }



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

function changeCartQuantity(
  id,
  delta,
  stock = 0
) {

  const decButton =
    document.querySelector(
      `.cart-dec[data-id="${CSS.escape(id)}"]`
    );

  const incButton =
    document.querySelector(
      `.cart-inc[data-id="${CSS.escape(id)}"]`
    );

  const cartRow =
    (decButton || incButton)?.closest(
      '.cartrow'
    );

  const quantityBox =
    cartRow?.querySelector(
      '.cart-qty-value'
    );

  if (!cartRow || !quantityBox) {
    return;
  }

  const maxStock =
    stock ||
    Number(incButton?.dataset.stock || 0);

  const currentQty =
    Math.max(
      1,
      Number(
        quantityBox.textContent ||
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
    maxStock > 0 &&
    newQty > maxStock
  ) {

    window.MC.toast(
      'Stock limit reached.',
      'error'
    );

    return;

  }

  /* Show the new quantity immediately. */

  quantityBox.textContent = newQty;

  if (decButton) {
    decButton.disabled = newQty <= 1;
  }

  if (incButton) {
    incButton.disabled =
      maxStock < 1 || newQty >= maxStock;
  }

  const price = Number(cartRow.dataset.price || 0);
  const lineBox = cartRow.querySelector('.cart-line-total');

  if (price > 0 && lineBox) {
    lineBox.textContent = window.MC.money(price * newQty);
  }

  showProvisionalSubtotal();

  /* Send only the final number, after a short pause. */

  qtyPending.add(id);
  clearTimeout(qtyTimers.get(id));

  qtyTimers.set(
    id,
    setTimeout(
      () => sendCartQuantity(id, newQty),
      350
    )
  );

}


function showProvisionalSubtotal() {

  let sum = 0;

  document.querySelectorAll('.cartrow').forEach(row => {
    sum +=
      Number(row.dataset.price || 0) *
      Number(
        row.querySelector('.cart-qty-value')?.textContent || 1
      );
  });

  const lines = document.querySelectorAll('#summary .summaryline');

  if (lines[0] && sum > 0) {
    lines[0].querySelector('b').textContent = window.MC.money(sum);
  }

  // Delivery and total are confirmed by the server a moment later.
  if (lines[2]) {
    lines[2].style.opacity = '.5';
  }

}


async function sendCartQuantity(id, quantity) {

  qtyTimers.delete(id);

  try {

    await window.MC.api(
      '/cart/' +
      encodeURIComponent(id),
      {
        method: 'PUT',
        body: JSON.stringify({ quantity })
      }
    );

    qtyPending.delete(id);

    // Refresh totals once every change has been saved.
    if (!qtyPending.size && !qtyTimers.size) {
      await loadCartPage();
    }

  } catch (error) {

    qtyPending.delete(id);

    window.MC.toast(
      error.message ||
      'Quantity update failed.',
      'error'
    );

    // Put the real quantities back.
    if (!qtyPending.size && !qtyTimers.size) {
      await loadCartPage();
    }

  }

}


/* =========================
   REMOVE ITEM
========================= */

async function removeCartItem(
  id
) {

  if (cartUpdating || qtyPending.size) {
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
