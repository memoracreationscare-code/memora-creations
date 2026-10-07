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

  try {

    return new Date(
      value
    )
      .toLocaleString(
        'en-IN'
      );

  } catch {

    return '';

  }

}


/* =========================
   LOAD ORDERS
========================= */

async function loadOrdersPage() {

  const user =
    await window.MC.requireLogin();


  if (!user) {
    return;
  }


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
      data.orders || [];


    ordersBox.innerHTML =
      orders.length

        ? orders
            .map(
              order => {

                const firstItem =
                  order.items?.[0];


                const image =
                  firstItem?.imageUrl ||
                  'https://placehold.co/100x100?text=Memora';


                const itemCount =
                  Array.isArray(
                    order.items
                  )

                    ? order.items.length

                    : 0;


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

                  <div
                    class="card"
                    style="
                      margin-bottom:16px;
                    "
                  >

                    <div
                      class="cardbody order-row"
                      style="
                        display:grid;
                        grid-template-columns:
                          90px
                          minmax(180px,1.4fr)
                          minmax(150px,1fr)
                          minmax(130px,1fr)
                          auto;
                        gap:20px;
                        align-items:center;
                      "
                    >


                      <!-- IMAGE -->

                      <div>

                        <img
                          src="${window.MC.esc(image)}"
                          alt="${window.MC.esc(
                            firstItem?.name ||
                            'Product'
                          )}"
                          style="
                            width:80px;
                            height:80px;
                            object-fit:cover;
                            border-radius:12px;
                            display:block;
                          "
                        >

                      </div>


                      <!-- ORDER INFO -->

                      <div>

                        <div
                          style="
                            font-weight:800;
                            font-size:17px;
                            margin-bottom:6px;
                          "
                        >

                          ${window.MC.esc(
                            order.orderId ||
                            ''
                          )}

                        </div>


                        <div
                          class="muted"
                        >

                          ${window.MC.esc(
                            formatOrderDate(
                              order.createdAt
                            )
                          )}

                        </div>

                      </div>


                      <!-- PAYMENT -->

                      <div>

                        <div>

                          <b>
                            ${itemCount}
                          </b>

                          item(s)

                        </div>


                        <div
                          class="muted"
                        >

                          ${window.MC.esc(
                            paymentLabel
                          )}

                        </div>


                        <div
                          class="muted"
                        >

                          ${window.MC.esc(
                            order.paymentStatus ||
                            ''
                          )}

                        </div>

                      </div>


                      <!-- TOTAL / STATUS -->

                      <div>

                        <div
                          class="price"
                          style="
                            margin-bottom:7px;
                          "
                        >

                          ${window.MC.money(
                            order.grandTotal
                          )}

                        </div>


                        <span
                          class="pill"
                        >

                          ${window.MC.esc(
                            order.orderStatus ||
                            ''
                          )}

                        </span>

                      </div>


                      <!-- ACTIONS -->

                      <div
                        class="actions"
                        style="
                          justify-content:flex-end;
                        "
                      >

                        <a
                          class="btn secondary"
                          href="${ORDERS_BASE}/frontend/order-details.html?id=${encodeURIComponent(order._id)}"
                        >
                          View / Track
                        </a>


                        ${
                          canCancel

                            ? `

                              <button
                                class="btn danger cancel-order"
                                type="button"
                                data-id="${order._id}"
                              >
                                Cancel
                              </button>

                            `

                            : ''
                        }

                      </div>

                    </div>

                  </div>

                `;

              }
            )
            .join('')

        : `

            <div class="empty">
              No orders yet.
            </div>

          `;


    /* CANCEL BUTTON */

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

      <div class="empty">
        Orders load nahi ho pa rahe hain.
      </div>

    `;


    window.MC.toast(
      error.message ||
      'Orders load failed.',
      'error'
    );

  }

}


/* =========================
   CANCEL ORDER
========================= */

async function cancelCustomerOrder(
  id,
  button = null
) {

  if (orderActionRunning) {
    return;
  }


  const confirmed =
    confirm(
      'Are you sure you want to cancel this order?'
    );


  if (!confirmed) {
    return;
  }


  orderActionRunning =
    true;


  const oldButtonText =
    button
      ?.textContent;


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
        oldButtonText ||
        'Cancel';

    }


  } finally {

    orderActionRunning =
      false;

  }

}


/* =========================
   MOBILE RESPONSIVE FIX
========================= */

(function addOrderResponsiveStyle() {

  if (
    document.querySelector(
      '#ordersResponsiveStyle'
    )
  ) {

    return;

  }


  const style =
    document.createElement(
      'style'
    );


  style.id =
    'ordersResponsiveStyle';


  style.textContent = `

    @media (max-width:900px) {

      .order-row {
        grid-template-columns:
          80px 1fr !important;
      }

      .order-row > div:nth-child(3),
      .order-row > div:nth-child(4),
      .order-row > div:nth-child(5) {
        grid-column:
          2 / -1;
      }

      .order-row .actions {
        justify-content:
          flex-start !important;
      }

    }


    @media (max-width:520px) {

      .order-row {
        grid-template-columns:
          1fr !important;
      }

      .order-row > div {
        grid-column:
          1 / -1 !important;
      }

      .order-row img {
        width:100px !important;
        height:100px !important;
      }

    }

  `;


  document.head.appendChild(
    style
  );

})();


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
