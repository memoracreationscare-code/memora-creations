const CART_BASE = '/memora-creations';

async function loadCartPage() {
  const user = await window.MC.requireLogin();

  if (!user) return;

  try {
    const data = await window.MC.api('/cart');

    const cart = data.cart;

    const itemsBox = window.MC.$('#cartItems');
    const summaryBox = window.MC.$('#summary');

    itemsBox.innerHTML = cart.items.length
      ? cart.items.map(item => `
          <div class="cartrow">

            <img
              src="${window.MC.esc(
                item.product.images?.[0]?.url ||
                'https://placehold.co/120'
              )}"
              alt="${window.MC.esc(item.product.name)}"
            >

            <div>

              <h3>
                ${window.MC.esc(item.product.name)}
              </h3>

              <div>
                ${window.MC.money(item.product.sellingPrice)}
              </div>

              <div class="qty">

                <button
                  class="btn secondary cart-dec"
                  type="button"
                  data-id="${item.id}"
                >
                  −
                </button>

                <span>
                  ${item.quantity}
                </span>

                <button
                  class="btn secondary cart-inc"
                  type="button"
                  data-id="${item.id}"
                  data-stock="${item.product.stock}"
                >
                  +
                </button>

              </div>

            </div>


            <div>

              <b>
                ${window.MC.money(item.lineTotal)}
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
        `).join('')
      : `
          <div class="empty">
            Your cart is empty.
          </div>
        `;


    summaryBox.innerHTML = `

      <div class="summaryline">

        <span>Subtotal</span>

        <b>
          ${window.MC.money(cart.subtotal)}
        </b>

      </div>


      <div class="summaryline">

        <span>Delivery</span>

        <b>
          ${window.MC.money(cart.deliveryCharge)}
        </b>

      </div>


      <div class="summaryline total">

        <span>Total</span>

        <b>
          ${window.MC.money(cart.grandTotal)}
        </b>

      </div>


      <button
        class="btn"
        id="checkoutBtn"
        type="button"
        ${cart.items.length ? '' : 'disabled'}
      >
        Proceed to Checkout
      </button>
    `;


    window.MC.$$('.cart-dec').forEach(button => {
      button.onclick = () =>
        changeCartQuantity(
          button.dataset.id,
          -1
        );
    });


    window.MC.$$('.cart-inc').forEach(button => {
      button.onclick = () =>
        changeCartQuantity(
          button.dataset.id,
          1,
          Number(button.dataset.stock)
        );
    });


    window.MC.$$('.cart-remove').forEach(button => {
      button.onclick = () =>
        removeCartItem(
          button.dataset.id
        );
    });


    const checkoutBtn =
      window.MC.$('#checkoutBtn');

    if (checkoutBtn) {
      checkoutBtn.onclick = () => {
        location.href =
          CART_BASE +
          '/frontend/checkout.html';
      };
    }


    window.MC.updateCartCount();

  } catch (error) {

    console.error(
      'Cart loading error:',
      error
    );

    window.MC.toast(
      error.message || 'Cart load failed.',
      'error'
    );

  }
}


async function changeCartQuantity(
  id,
  delta,
  stock
) {

  const button =
    document.querySelector(
      `[data-id="${id}"]`
    );

  const quantityBox =
    button?.parentElement
      ?.querySelector('span');

  const currentQty =
    Number(
      quantityBox?.textContent || 1
    );

  const newQty =
    currentQty + delta;


  if (newQty < 1) {
    return;
  }


  if (
    stock &&
    newQty > stock
  ) {

    window.MC.toast(
      'Stock limit reached.',
      'error'
    );

    return;
  }


  try {

    await window.MC.api(
      '/cart/' + encodeURIComponent(id),
      {
        method: 'PUT',
        body: JSON.stringify({
          quantity: newQty
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

  }
}


async function removeCartItem(id) {

  try {

    await window.MC.api(
      '/cart/' + encodeURIComponent(id),
      {
        method: 'DELETE'
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

  }
}


if (window.MC.$('#cartItems')) {

  loadCartPage();

}
