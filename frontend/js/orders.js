const ORDERS_BASE = '/memora-creations';

async function loadOrdersPage() {

  const user = await window.MC.requireLogin();

  if (!user) return;

  try {

    const data = await window.MC.api('/orders');

    const ordersBox = window.MC.$('#orders');

    const orders = data.orders || [];

    ordersBox.innerHTML = orders.length
      ? orders.map(order => {

          const firstItem = order.items?.[0];

          return `
            <div
              class="card"
              style="margin-bottom:16px;"
            >

              <div
                class="cardbody"
                style="
                  display:grid;
                  grid-template-columns:90px 1.4fr 1fr 1fr auto;
                  gap:20px;
                  align-items:center;
                "
              >

                <div>
                  <img
                    src="${window.MC.esc(
                      firstItem?.imageUrl ||
                      'https://placehold.co/100x100?text=Memora'
                    )}"
                    alt="${window.MC.esc(
                      firstItem?.name || 'Product'
                    )}"
                    style="
                      width:80px;
                      height:80px;
                      object-fit:cover;
                      border-radius:12px;
                    "
                  >
                </div>

                <div>

                  <div
                    style="
                      font-weight:800;
                      font-size:17px;
                      margin-bottom:6px;
                    "
                  >
                    ${window.MC.esc(order.orderId)}
                  </div>

                  <div class="muted">
                    ${new Date(order.createdAt)
                      .toLocaleString('en-IN')}
                  </div>

                </div>

                <div>

                  <div>
                    <b>${order.items.length}</b>
                    item(s)
                  </div>

                  <div class="muted">
                    ${
                      order.paymentMethod === 'COD'
                        ? 'Cash on Delivery'
                        : 'Online Payment'
                    }
                  </div>

                  <div class="muted">
                    ${window.MC.esc(order.paymentStatus)}
                  </div>

                </div>

                <div>

                  <div
                    class="price"
                    style="margin-bottom:7px;"
                  >
                    ${window.MC.money(order.grandTotal)}
                  </div>

                  <span class="pill">
                    ${window.MC.esc(order.orderStatus)}
                  </span>

                </div>

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

            </div>
          `;
        }).join('')

      : `
        <div class="empty">
          No orders yet.
        </div>
      `;


    window.MC.$$('.cancel-order')
      .forEach(button => {

        button.onclick = () => {
          cancelCustomerOrder(
            button.dataset.id
          );
        };

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


async function cancelCustomerOrder(id) {

  const confirmed = confirm(
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


document.addEventListener(
  'DOMContentLoaded',
  () => {
    loadOrdersPage();
  }
);
