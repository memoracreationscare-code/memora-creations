const ORDERS_BASE =
  '/memora-creations';


let orderActionRunning =
  false;


/* =========================
   FORMAT DATE
========================= */

function formatOrderDate(
  value
) {

  if (!value) {
    return '';
  }


  try {

    return new Date(
      value
    )
      .toLocaleString(
        'en-IN',
        {
          day:
            '2-digit',

          month:
            'short',

          year:
            'numeric',

          hour:
            '2-digit',

          minute:
            '2-digit'
        }
      );

  } catch {

    return '';

  }

}


/* =========================
   STATUS CLASS
========================= */

function orderStatusClass(
  status
) {

  const value =
    String(
      status || ''
    )
      .toLowerCase();


  if (
    value ===
    'delivered'
  ) {

    return 'delivered';

  }


  if (
    value ===
    'cancelled'
  ) {

    return 'cancelled';

  }


  if (
    value ===
    'shipped' ||
    value ===
    'out for delivery'
  ) {

    return 'shipping';

  }


  return 'processing';

}


/* =========================
   PAYMENT CLASS
========================= */

function paymentStatusClass(
  status
) {

  const value =
    String(
      status || ''
    )
      .toUpperCase();


  if (
    value ===
    'SUCCESS'
  ) {

    return 'paid';

  }


  if (
    value ===
    'FAILED' ||
    value ===
    'CANCELLED'
  ) {

    return 'failed';

  }


  return 'pending';

}


/* =========================
   ORDER PRODUCTS
========================= */

function orderProductsHtml(
  order
) {

  const items =
    Array.isArray(
      order.items
    )
      ? order.items
      : [];


  if (!items.length) {

    return `

      <div class="order-no-product">
        Product information available nahi hai.
      </div>

    `;

  }


  return items
    .map(
      item => {

        const image =
          item.imageUrl ||
          'https://placehold.co/180x180?text=Memora';


        const quantity =
          Math.max(
            1,
            Number(
              item.quantity ||
              1
            )
          );


        return `

          <div class="order-product">

            <div class="order-product-image">

              <img
                src="${window.MC.esc(
                  image
                )}"
                alt="${window.MC.esc(
                  item.name ||
                  'Product'
                )}"
                loading="lazy"
              >

            </div>


            <div class="order-product-info">

              <h3>

                ${window.MC.esc(
                  item.name ||
                  'Product'
                )}

              </h3>


              <div class="order-product-meta">

                <span>
                  Qty:
                  <strong>
                    ${quantity}
                  </strong>
                </span>


                <span>
                  Price:
                  <strong>
                    ${window.MC.money(
                      item.unitPrice
                    )}
                  </strong>
                </span>

              </div>

            </div>


            <div class="order-product-total">

              ${window.MC.money(
                item.lineTotal
              )}

            </div>

          </div>

        `;

      }
    )
    .join('');

}


/* =========================
   ORDER CARD
========================= */

function orderCardHtml(
  order
) {

  const items =
    Array.isArray(
      order.items
    )
      ? order.items
      : [];


  const totalQuantity =
    items.reduce(
      (
        total,
        item
      ) =>
        total +
        Math.max(
          1,
          Number(
            item.quantity ||
            1
          )
        ),
      0
    );


  const paymentLabel =
    order.paymentMethod ===
    'COD'
      ? 'Cash on Delivery'
      : 'Online Payment';


  const canCancel =
    [
      'Order Placed',
      'Confirmed'
    ]
      .includes(
        order.orderStatus
      );


  return `

    <article class="order-card">


      <!-- TOP -->

      <div class="order-card-top">

        <div>

          <span class="order-label">
            ORDER ID
          </span>

          <h2>
            ${window.MC.esc(
              order.orderId ||
              'Order'
            )}
          </h2>

          <p>
            ${window.MC.esc(
              formatOrderDate(
                order.createdAt
              )
            )}
          </p>

        </div>


        <div
          class="order-status ${orderStatusClass(
            order.orderStatus
          )}"
        >

          ${window.MC.esc(
            order.orderStatus ||
            'Order Placed'
          )}

        </div>

      </div>


      <!-- PRODUCTS -->

      <div class="order-products">

        ${orderProductsHtml(
          order
        )}

      </div>


      <!-- DETAILS -->

      <div class="order-info-grid">


        <div>

          <span>
            Items
          </span>

          <strong>
            ${totalQuantity}
          </strong>

        </div>


        <div>

          <span>
            Payment
          </span>

          <strong>
            ${window.MC.esc(
              paymentLabel
            )}
          </strong>

        </div>


        <div>

          <span>
            Payment Status
          </span>

          <strong
            class="payment-state ${paymentStatusClass(
              order.paymentStatus
            )}"
          >

            ${window.MC.esc(
              order.paymentStatus ||
              ''
            )}

          </strong>

        </div>


        <div>

          <span>
            Order Total
          </span>

          <strong class="order-grand-total">

            ${window.MC.money(
              order.grandTotal
            )}

          </strong>

        </div>

      </div>


      <!-- ACTION -->

      <div class="order-actions">

        <a
          class="order-track-btn"
          href="${ORDERS_BASE}/frontend/order-details.html?id=${encodeURIComponent(
            order._id
          )}"
        >
          View / Track Order →
        </a>


        ${
          canCancel

            ? `

              <button
                class="order-cancel-btn cancel-order"
                type="button"
                data-id="${window.MC.esc(
                  order._id
                )}"
              >
                Cancel Order
              </button>

            `

            : ''
        }

      </div>

    </article>

  `;

}


/* =========================
   LOAD ORDERS
========================= */

async function loadOrdersPage() {

  const ordersBox =
    window.MC.$(
      '#orders'
    );


  if (!ordersBox) {
    return;
  }


  try {

    const data =
      await window.MC.api(
        '/orders'
      );


    const orders =
      Array.isArray(
        data.orders
      )
        ? data.orders
        : [];


    const countBox =
      window.MC.$(
        '#orderCount'
      );


    if (countBox) {

      countBox.textContent =
        `${orders.length} ${
          orders.length === 1
            ? 'order'
            : 'orders'
        }`;

    }


    ordersBox.innerHTML =

      orders.length

        ? orders
            .map(
              orderCardHtml
            )
            .join('')

        : `

            <div class="orders-empty">

              <div class="orders-empty-icon">
                🛍️
              </div>


              <h2>
                No Orders Yet
              </h2>


              <p>
                Aapne abhi tak koi order place nahi kiya hai.
              </p>


              <a
                href="${ORDERS_BASE}/frontend/products.html"
              >
                Start Shopping
              </a>

            </div>

          `;


    window.MC
      .$$(
        '.cancel-order'
      )
      .forEach(
        button => {

          button.onclick =
            async () => {

              await cancelCustomerOrder(
                button.dataset.id,
                button
              );

            };

        }
      );


  } catch (error) {

    console.error(
      'Orders load error:',
      error
    );


    ordersBox.innerHTML = `

      <div class="orders-empty">

        <div class="orders-empty-icon">
          ⚠️
        </div>

        <h2>
          Orders load nahi ho pa rahe hain
        </h2>

        <p>
          Please thodi der baad dobara try karein.
        </p>

      </div>

    `;


    const countBox =
      window.MC.$(
        '#orderCount'
      );


    if (countBox) {

      countBox.textContent =
        'Error';

    }


    window.MC.toast(
      error.message ||
      'Orders load failed.',
      'error'
    );

  }

}


/* =========================
   CANCEL CONFIRM POPUP
========================= */

function askCancelConfirmation() {

  return new Promise(
    resolve => {

      document
        .querySelector(
          '#cancelOrderPopup'
        )
        ?.remove();


      const overlay =
        document.createElement(
          'div'
        );


      overlay.id =
        'cancelOrderPopup';


      overlay.className =
        'cancel-popup-overlay';


      overlay.innerHTML = `

        <div class="cancel-popup">

          <div class="cancel-popup-icon">
            !
          </div>


          <h2>
            Cancel Order?
          </h2>


          <p>
            Kya aap sure hain ki
            is order ko cancel karna chahte hain?
          </p>


          <div class="cancel-popup-actions">

            <button
              class="cancel-popup-back"
              type="button"
            >
              Keep Order
            </button>


            <button
              class="cancel-popup-confirm"
              type="button"
            >
              Yes, Cancel
            </button>

          </div>

        </div>

      `;


      document.body.appendChild(
        overlay
      );


      const finish =
        value => {

          overlay.remove();

          resolve(
            value
          );

        };


      overlay
        .querySelector(
          '.cancel-popup-back'
        )
        ?.addEventListener(
          'click',
          () =>
            finish(false)
        );


      overlay
        .querySelector(
          '.cancel-popup-confirm'
        )
        ?.addEventListener(
          'click',
          () =>
            finish(true)
        );


      overlay.addEventListener(
        'click',
        event => {

          if (
            event.target === overlay
          ) {

            finish(false);

          }

        }
      );

    }
  );

}


/* =========================
   CANCEL ORDER
========================= */

async function cancelCustomerOrder(
  id,
  button = null
) {

  if (
    orderActionRunning
  ) {

    return;

  }


  const confirmed =
    await askCancelConfirmation();


  if (!confirmed) {
    return;
  }


  orderActionRunning =
    true;


  const oldText =
    button?.textContent;


  if (button) {

    button.disabled =
      true;


    button.textContent =
      'Cancelling...';

  }


  try {

    await window.MC.api(
      '/orders/' +
      encodeURIComponent(id) +
      '/cancel',
      {

        method:
          'PATCH'

      }
    );


    window.MC.toast(
      'Order cancelled successfully.',
      'success'
    );


    await loadOrdersPage();


  } catch (error) {

    window.MC.toast(
      error.message ||
      'Order cancel failed.',
      'error'
    );


    if (button) {

      button.disabled =
        false;


      button.textContent =
        oldText ||
        'Cancel Order';

    }


  } finally {

    orderActionRunning =
      false;

  }

}


/* =========================
   START
========================= */

if (
  window.MC.$(
    '#orders'
  )
) {

  loadOrdersPage();

}
