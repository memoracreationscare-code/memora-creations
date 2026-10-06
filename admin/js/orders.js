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


/* =========================
   PRINT SHIPPING LABEL
========================= */

function printShippingLabel(order) {

  const address =
    order.shippingAddress || {};

  const customerName =
    order.customer?.fullName ||
    order.user?.fullName ||
    address.fullName ||
    '';

  const mobile =
    order.customer?.mobile ||
    order.user?.mobile ||
    address.mobile ||
    '';

  const email =
    order.customer?.email ||
    order.user?.email ||
    '';

  const paymentText =
    order.paymentMethod === 'COD'
      ? `COD - ₹${Number(order.grandTotal || 0).toLocaleString('en-IN')}`
      : 'PREPAID';

  const products =
    (order.items || [])
      .map((item, index) => `
        <tr>
          <td>${index + 1}</td>

          <td>
            ${window.MC.esc(item.name || '')}
            ${
              item.productId
                ? `<div class="small">${window.MC.esc(item.productId)}</div>`
                : ''
            }
          </td>

          <td class="center">
            ${Number(item.quantity || 0)}
          </td>
        </tr>
      `)
      .join('');


  const labelWindow =
    window.open(
      '',
      '_blank',
      'width=700,height=900'
    );


  if (!labelWindow) {

    window.MC.toast(
      'Popup blocked. Please allow popups.',
      'error'
    );

    return;
  }


  labelWindow.document.write(`

    <!doctype html>

    <html>

    <head>

      <meta charset="utf-8">

      <title>
        Shipping Label - ${window.MC.esc(order.orderId || '')}
      </title>

      <style>

        @page {
          size: 100mm 150mm;
          margin: 4mm;
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          padding: 0;
          font-family: Arial, sans-serif;
          color: #000;
          background: #fff;
        }

        .label {
          width: 92mm;
          min-height: 140mm;
          border: 2px solid #000;
          padding: 4mm;
          margin: auto;
        }

        .brand {
          text-align: center;
          font-size: 20px;
          font-weight: 800;
          letter-spacing: 1px;
          border-bottom: 2px solid #000;
          padding-bottom: 7px;
          margin-bottom: 8px;
        }

        .payment {
          text-align: center;
          font-size: 20px;
          font-weight: 900;
          padding: 8px;
          border: 2px solid #000;
          margin-bottom: 10px;
        }

        .section {
          border-bottom: 1px solid #000;
          padding: 7px 0;
        }

        .section:last-child {
          border-bottom: none;
        }

        .title {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .big {
          font-size: 16px;
          font-weight: 800;
        }

        .normal {
          font-size: 13px;
          line-height: 1.45;
        }

        .small {
          font-size: 10px;
          margin-top: 2px;
        }

        .order-id {
          font-size: 14px;
          font-weight: 800;
          word-break: break-all;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 5px;
          font-size: 11px;
        }

        th,
        td {
          border: 1px solid #000;
          padding: 5px;
          text-align: left;
        }

        .center {
          text-align: center;
        }

        .total {
          font-size: 15px;
          font-weight: 900;
        }

        .footer {
          text-align: center;
          font-size: 10px;
          padding-top: 8px;
        }

        .no-print {
          text-align: center;
          margin: 15px;
        }

        .print-btn {
          padding: 10px 20px;
          font-size: 15px;
          cursor: pointer;
        }

        @media print {

          .no-print {
            display: none;
          }

          .label {
            border: 2px solid #000;
          }

        }

      </style>

    </head>


    <body>


      <div class="no-print">

        <button
          class="print-btn"
          onclick="window.print()"
        >
          Print Label
        </button>

      </div>


      <div class="label">


        <div class="brand">
          MEMORA CREATIONS
        </div>


        <div class="payment">
          ${paymentText}
        </div>


        <div class="section">

          <div class="title">
            Order ID
          </div>

          <div class="order-id">
            ${window.MC.esc(order.orderId || '')}
          </div>

          <div class="small">
            Order Date:
            ${
              order.createdAt
                ? new Date(order.createdAt)
                    .toLocaleString('en-IN')
                : ''
            }
          </div>

        </div>


        <div class="section">

          <div class="title">
            Ship To
          </div>

          <div class="big">
            ${window.MC.esc(customerName)}
          </div>

          <div class="normal">

            ${window.MC.esc(address.addressLine || '')}

            <br>

            ${window.MC.esc(address.city || '')}

            ${
              address.state
                ? ', ' + window.MC.esc(address.state)
                : ''
            }

            <br>

            <b>
              PIN:
              ${window.MC.esc(address.pinCode || '')}
            </b>

            <br>

            Mobile:
            <b>${window.MC.esc(mobile)}</b>

            ${
              email
                ? `<br>Email: ${window.MC.esc(email)}`
                : ''
            }

          </div>

        </div>


        <div class="section">

          <div class="title">
            Package Contents
          </div>

          <table>

            <thead>

              <tr>
                <th>#</th>
                <th>Product</th>
                <th class="center">Qty</th>
              </tr>

            </thead>

            <tbody>

              ${
                products ||
                `
                  <tr>
                    <td colspan="3">
                      No products
                    </td>
                  </tr>
                `
              }

            </tbody>

          </table>

        </div>


        <div class="section normal">

          <div>
            Payment Method:
            <b>
              ${window.MC.esc(order.paymentMethod || '')}
            </b>
          </div>

          <div>
            Payment Status:
            <b>
              ${window.MC.esc(order.paymentStatus || '')}
            </b>
          </div>

          <div>
            Order Status:
            <b>
              ${window.MC.esc(order.orderStatus || '')}
            </b>
          </div>

          <br>

          <div class="total">
            Total:
            ₹${Number(order.grandTotal || 0)
              .toLocaleString('en-IN')}
          </div>

        </div>


        <div class="footer">
          Thank you for shopping with MEMORA CREATIONS
        </div>


      </div>


      <script>

        setTimeout(function () {
          window.print();
        }, 500);

      <\/script>


    </body>

    </html>

  `);


  labelWindow.document.close();

}


/* =========================
   ORDER DETAILS
========================= */

function orderDetailsHtml(order) {

  const address =
    order.shippingAddress || {};


  const items =
    (order.items || [])
      .map(item => `

        <div
          class="admin-card"
          style="margin:10px 0;"
        >

          <div
            style="
              display:flex;
              gap:15px;
              align-items:center;
            "
          >

            ${
              item.imageUrl
                ? `
                  <img
                    src="${window.MC.esc(item.imageUrl)}"
                    width="70"
                    height="70"
                    style="
                      object-fit:cover;
                      border-radius:10px;
                    "
                  >
                `
                : ''
            }


            <div style="flex:1;">

              <b>
                ${window.MC.esc(item.name || '')}
              </b>

              <div class="mini">
                Product ID:
                ${window.MC.esc(item.productId || '')}
              </div>

              <div>
                Qty:
                ${Number(item.quantity || 0)}
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


  const history =
    (order.statusHistory || [])
      .map(item => `

        <div style="margin-bottom:10px;">

          <b>
            ${window.MC.esc(item.status || '')}
          </b>

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
              ? `
                <div>
                  ${window.MC.esc(item.note)}
                </div>
              `
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


      ${
        items ||
        '<p>No products found.</p>'
      }


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
        <b>
          ${window.MC.money(order.subtotal)}
        </b>

        <br>

        Delivery:
        <b>
          ${window.MC.money(order.deliveryCharge)}
        </b>

        <br>

        You Save:
        <b>
          ${window.MC.money(order.discount)}
        </b>

        <br>

        Total:
        <b>
          ${window.MC.money(order.grandTotal)}
        </b>

      </p>


      <h3>
        Status History
      </h3>


      ${
        history ||
        '<p>No status history.</p>'
      }


      <div
        style="
          display:flex;
          gap:10px;
          flex-wrap:wrap;
          margin-top:15px;
        "
      >

        <button
          class="btn print-label"
          type="button"
          data-id="${order._id}"
        >
          🖨 Print Shipping Label
        </button>


        <button
          class="btn secondary close-details"
          type="button"
        >
          Close Details
        </button>

      </div>


    </div>

  `;

}


/* =========================
   BIND BUTTONS
========================= */

function bindOrderButtons() {

  document
    .querySelectorAll('.view-order')
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          const id =
            button.dataset.id;


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
            .querySelector('.print-label')
            ?.addEventListener(
              'click',
              () => {

                printShippingLabel(order);

              }
            );


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


/* =========================
   LOAD ORDERS
========================= */

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


/* =========================
   SEARCH
========================= */

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
