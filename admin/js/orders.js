const ADMIN_ORDER_STATUSES = [
  'Order Placed',
  'Confirmed',
  'Packed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
  'Cancelled'
];

async function loadAdminOrders() {
  const admin = await window.requireAdmin();

  if (!admin) return;

  const searchInput =
    document.querySelector('#search');

  const ordersBox =
    document.querySelector('#orders');

  const search =
    searchInput?.value || '';

  try {
    const data =
      await window.MC.api(
        '/admin/orders?search=' +
        encodeURIComponent(search)
      );

    const orders =
      data.orders || [];

    if (!orders.length) {
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
      orders.map(order => `
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
          </td>

          <td>
            ${window.MC.esc(
              order.user?.fullName || 'Guest'
            )}
            <br>
            ${window.MC.esc(
              order.user?.mobile || ''
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
                    ${status === order.orderStatus
                      ? 'selected'
                      : ''}
                  >
                    ${status}
                  </option>
                `
              ).join('')}
            </select>
          </td>

        </tr>
      `).join('');

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
