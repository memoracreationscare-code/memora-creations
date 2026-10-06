const ORDERS_BASE = '/memora-creations';


/* =========================
   LOAD ORDERS
========================= */

async function loadOrdersPage() {

  const user =
    await window.MC.requireLogin();

  if (!user) return;


  try {

    const data =
      await window.MC.api('/orders');


    const ordersBox =
      window.MC.$('#orders');


    const orders =
      data.orders || [];


    ordersBox.innerHTML =
      orders.length

        ? orders.map(order => `

            <div class="orderrow">

              <div>

                <b>
                  ${window.MC.esc(
                    order.orderId
                  )}
                </b>

                <div class="muted">

                  ${new Date(
                    order.createdAt
                  ).toLocaleString('en-IN')}

                </div>

              </div>


              <div>

                ${order.items.length}
                item(s)

                <br>

                ${window.MC.esc(
                  order.paymentMethod
                )}

                /

                ${window.MC.esc(
                  order.paymentStatus
                )}

              </div>


              <div>

                <b>
                  ${window.MC.money(
                    order.grandTotal
                  )}
                </b>

                <br>

                <span class="pill">
                  ${window.MC.esc(
                    order.orderStatus
                  )}
                </span>

              </div>


              <div class="actions">

                <a
                  class="btn secondary"
                  href="${ORDERS_BASE}/frontend/order-details.html?id=${encodeURIComponent(order._id)}"
                >
                  View / Track
                </a>


                ${
                  ['Order Placed', 'Confirmed']
                    .includes(order.orderStatus)

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

          `).join('')

        : `
            <div class="empty">
              No orders yet.
            </div>
          `;


    window.MC
      .$$('.cancel-order')
      .forEach(button => {

        button.onclick = () =>
          cancelOrder(
            button.dataset.id
          );

      });


  } catch (error) {

    console.error(
      'Orders load error:',
      error
    );

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

async function cancelOrder(id) {

  const confirmed =
    confirm(
      'Are you sure you want to cancel this order?'
    );


  if (!confirmed) return;


  try {

    await window.MC.api(
      '/orders/' +
      encodeURIComponent(id) +
      '/cancel',
      {
        method: 'PATCH'
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

  }

}


/* =========================
   START
========================= */

loadOrdersPage();
