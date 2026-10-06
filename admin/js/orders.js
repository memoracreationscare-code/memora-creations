const ADMIN_ORDER_STATUSES = [
  'Order Placed',
  'Confirmed',
  'Packed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
  'Cancelled'
];

let adminOrders = [];


function orderDetailsHtml(order) {

  const address = order.shippingAddress || {};

  const items = (order.items || [])
    .map(item => `
      <div class="admin-card" style="margin:10px 0;">
        <div style="display:flex;gap:15px;align-items:center;">

          ${
            item.imageUrl
              ? `
                <img
                  src="${window.MC.esc(item.imageUrl)}"
                  width="70"
                  height="70"
                  style="object-fit:cover;border-radius:10px;"
                >
              `
              : ''
          }

          <div style="flex:1;">
            <b>${window.MC.esc(item.name || '')}</b>

            <div class="mini">
              Product ID:
              ${window.MC.esc(item.productId || '')}
            </div>

            <div>
              Qty: ${Number(item.quantity || 0)}
            </div>

            <div>
              Price:
              ${window.MC.money(item.unitPrice)}
            </div>
          </div>

          <b>
            ${window.MC.money(item.lineTotal)}
          </b>

        </div>
      </div>
    `)
    .join('');


  const history = (order.statusHistory || [])
    .map(item => `
      <div style="margin-bottom:10px;">
        <b>${window.MC.esc(item.status || '')}</b>

        <div class="mini">
          ${
            item.changedAt
              ? new Date(item.changedAt)
                  .toLocaleString('en-IN')
              : ''
          }
        </div>

        ${
          item.note
            ? `<div>${window.MC.esc(item.note)}</div>`
            : ''
        }
      </div>
    `)
    .join('');


  return `
    <div
      class="admin-card"
      style="margin:12px 0;"
    >

      <h2>
        Order Details
      </h2>

      <p>
        <b>Order ID:</b>
        ${window.MC.esc(order.orderId || '')}
      </p>

      <p>
        <b>Customer:</b>
        ${window.MC.esc(
          order.customer?.fullName ||
          order.user?.fullName ||
          ''
        )}
        <br>

        <b>Mobile:</b>
        ${window.MC.esc(
          order.customer?.mobile ||
          order.user?.mobile ||
          ''
        )}
        <br>

        <b>Email:</b>
        ${window.MC.esc(
          order.customer?.email ||
          order.user?.email ||
          ''
        )}
      </p>


      <h3>
        Delivery Address
      </h3>

      <p>
        ${window.MC.esc(address.fullName || '')}
        <br>

        ${window.MC.esc(address.addressLine || '')}
        <br>

        ${window.MC.esc(address.city || '')}

        ${
          address.state
            ? ', ' + window.MC.esc(address.state)
            : ''
        }

        <br>

        PIN:
        ${window.MC.esc(address.pinCode || '')}

        <br>

        Mobile:
        ${window.MC.esc(address.mobile || '')}
      </p>


      <h3>
        Products
      </h3>

      ${items || '<p>No products found.</p>'}


      <h3>
        Payment & Total
      </h3>

      <p>
        <b>Payment Method:</b>
        ${window.MC.esc(order.paymentMethod || '')}
        <br>

        <b>Payment Status:</b>
        ${window.MC.esc(order.paymentStatus || '')}
        <br>

        <b>Order Status:</b>
        ${window.MC.esc(order.orderStatus || '')}
      </p>

      <p>
        Subtotal:
        <b>${window.MC.money(order.subtotal)}</b>
        <br>

        Delivery:
        <b>${window.MC.money(order.deliveryCharge)}</b>
        <br>

        You Save:
        <b>${window.MC.money(order.discount)}</b>
        <br>

        Total:
        <b>${window.MC.money(order.grandTotal)}</b>
      </p>


      <h3>
        Status History
      </h3>

      ${history || '<p>No status history.</p>'}


      <button
        class="btn secondary close-details"
        type="button"
      >
        Close Details
      </button>

    </div>
  `;
}


function bindOrderButtons() {

  document
    .querySelectorAll('.view-order')
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          const id = button.dataset.id;

          const order =
            adminOrders.find(
              item => item._id === id
            );

          const detailsRow =
            document.querySelector(
              `#details-${id}`
            );

          if (!order || !detailsRow) return;

          detailsRow.innerHTML = `
            <td colspan="6">
              ${orderDetailsHtml(order)}
            </td>
          `;

          detailsRow.style.display =
            'table-row';

          detailsRow
            .querySelector('.close-details')
            ?.addEventListener(
              'click',
              () => {
                detailsRow.style.display =
                  'none';
              }
            );
        }
      );

    });


  document
    .querySelectorAll('.order-status')
    .forEach(select => {

      select.addEventListener(
        'change',
        async () => {

          try {

            await window.MC.api(
              '/admin/orders/' +
              select.dataset.id,
              {
                method: 'PUT',

                body: JSON.stringify({
                  orderStatus:
                    select.value
                })
              }
            );

            window.MC.toast(
              'Order status updated.',
              'success'
            );

            await loadAdminOrders();

          } catch (error) {

            window.MC.toast(
              error.message ||
              'Order update failed.',
              'error'
            );

            await loadAdminOrders();

          }

        }
      );

    });

}


async function loadAdminOrders() {

  const admin =
    await window.requireAdmin();

  if (!admin) return;


  const search =
    document.querySelector('#search')
      ?.value || '';


  const ordersBox =
    document.querySelector('#orders');


  try {

    const data =
      await window.MC.api(
        '/admin/orders?search=' +
        encodeURIComponent(search)
      );


    adminOrders =
      data.orders || [];


    if (!adminOrders.length) {

      ordersBox.innerHTML = `
        <tr>
          <td colspan="6">
            No orders found.
          </td>
        </tr>
      `;

      return;
    }


    ordersBox.innerHTML =
      adminOrders.map(order => `

        <tr>

          <td>
            <b>
              ${window.MC.esc(order.orderId)}
            </b>

            <br>

            <span class="mini">
              ${new Date(order.createdAt)
                .toLocaleString('en-IN')}
            </span>

            <br><br>

            <button
              class="btn secondary view-order"
              type="button"
              data-id="${order._id}"
            >
              View Details
            </button>
          </td>


          <td>
            ${window.MC.esc(
              order.user?.fullName ||
              order.customer?.fullName ||
              'Guest'
            )}

            <br>

            ${window.MC.esc(
              order.user?.mobile ||
              order.customer?.mobile ||
              ''
            )}
          </td>


          <td>
            ${window.MC.money(
              order.grandTotal
            )}
          </td>


          <td>
            ${window.MC.esc(
              order.paymentMethod || ''
            )}

            <br>

            <span class="mini">
              ${window.MC.esc(
                order.paymentStatus || ''
              )}
            </span>
          </td>


          <td>
            ${window.MC.esc(
              order.orderStatus || ''
            )}
          </td>


          <td>

            <select
              class="select order-status"
              data-id="${order._id}"
            >

              ${ADMIN_ORDER_STATUSES.map(
                status => `
                  <option
                    value="${status}"
                    ${
                      status === order.orderStatus
                        ? 'selected'
                        : ''
                    }
                  >
                    ${status}
                  </option>
                `
              ).join('')}

            </select>

          </td>

        </tr>


        <tr
          id="details-${order._id}"
          style="display:none;"
        ></tr>

      `).join('');


    bindOrderButtons();


  } catch (error) {

    window.MC.toast(
      error.message ||
      'Orders load failed.',
      'error'
    );

  }

}


document
  .querySelector('#searchBtn')
  ?.addEventListener(
    'click',
    loadAdminOrders
  );


document
  .querySelector('#search')
  ?.addEventListener(
    'keydown',
    event => {

      if (event.key === 'Enter') {
        loadAdminOrders();
      }

    }
  );


loadAdminOrders();
