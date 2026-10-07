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
   PRINT PACKAGING LABEL
========================= */

function printShippingLabel(order) {

  const address = order.shippingAddress || {};

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

  const paymentText =
    order.paymentMethod === 'COD'
      ? `COD ₹${Number(order.grandTotal || 0).toLocaleString('en-IN')}`
      : 'PREPAID';

  const products = (order.items || [])
    .map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${window.MC.esc(item.name || '')}</td>
        <td>${Number(item.quantity || 0)}</td>
      </tr>
    `)
    .join('');

  const w = window.open(
    '',
    '_blank',
    'width=700,height=900'
  );

  if (!w) {
    window.MC.toast(
      'Please allow popups.',
      'error'
    );
    return;
  }

  w.document.write(`
    <!doctype html>

    <html>

    <head>

      <meta charset="utf-8">

      <title>
        Label - ${window.MC.esc(order.orderId || '')}
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
          font-family: Arial, sans-serif;
          margin: 0;
          color: #000;
        }

        .label {
          width: 92mm;
          min-height: 140mm;
          margin: auto;
          padding: 4mm;
          border: 2px solid #000;
        }

        .brand {
          text-align: center;
          font-size: 20px;
          font-weight: 800;
          padding-bottom: 8px;
          border-bottom: 2px solid #000;
        }

        .payment {
          margin: 8px 0;
          padding: 8px;
          border: 2px solid #000;
          text-align: center;
          font-size: 20px;
          font-weight: 900;
        }

        .section {
          padding: 8px 0;
          border-bottom: 1px solid #000;
          line-height: 1.45;
          font-size: 13px;
        }

        .title {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .name {
          font-size: 16px;
          font-weight: 800;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
        }

        th,
        td {
          border: 1px solid #000;
          padding: 5px;
        }

        .total {
          font-size: 16px;
          font-weight: 900;
        }

        .no-print {
          text-align: center;
          margin: 15px;
        }

        @media print {
          .no-print {
            display: none;
          }
        }

      </style>

    </head>

    <body>

      <div class="no-print">
        <button onclick="window.print()">
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

          <b>
            ${window.MC.esc(order.orderId || '')}
          </b>

          <br>

          ${
            order.createdAt
              ? new Date(order.createdAt)
                  .toLocaleString('en-IN')
              : ''
          }

        </div>

        <div class="section">

          <div class="title">
            Ship To
          </div>

          <div class="name">
            ${window.MC.esc(customerName)}
          </div>

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
                <th>Qty</th>
              </tr>
            </thead>

            <tbody>
              ${products}
            </tbody>

          </table>

        </div>

        <div class="section">

          Payment:
          <b>${window.MC.esc(order.paymentMethod || '')}</b>

          <br>

          Payment Status:
          <b>${window.MC.esc(order.paymentStatus || '')}</b>

          <br><br>

          <div class="total">
            Total:
            ₹${Number(order.grandTotal || 0).toLocaleString('en-IN')}
          </div>

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

  w.document.close();
}


/* =========================
   SHIPMENT FORM
========================= */

function shipmentFormHtml(order) {

  return `
    <div
      class="admin-card shipment-box"
      style="margin-top:20px;"
    >

      <h3>
        🚚 Shiprocket Shipping
      </h3>

      <p class="mini">
        Customer name, mobile, address, PIN, products,
        payment and order details automatic rahenge.
        Sirf package ka weight aur size bharo.
      </p>


      <form
        class="shipment-form"
        data-id="${order._id}"
      >

        <div class="formgrid">

          <div class="field">

            <label>
              Weight (KG)
            </label>

            <input
              class="input"
              name="weight"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Example: 0.5"
              required
            >

          </div>


          <div class="field">

            <label>
              Length (CM)
            </label>

            <input
              class="input"
              name="length"
              type="number"
              step="0.1"
              min="0.1"
              placeholder="Example: 30"
              required
            >

          </div>


          <div class="field">

            <label>
              Width (CM)
            </label>

            <input
              class="input"
              name="width"
              type="number"
              step="0.1"
              min="0.1"
              placeholder="Example: 25"
              required
            >

          </div>


          <div class="field">

            <label>
              Height (CM)
            </label>

            <input
              class="input"
              name="height"
              type="number"
              step="0.1"
              min="0.1"
              placeholder="Example: 8"
              required
            >

          </div>


          <div class="field full">

            <label>
              Pickup Location
            </label>

            <input
              class="input"
              name="pickupLocation"
              value="Home"
              required
            >

          </div>

        </div>


        <div
          style="
            display:flex;
            gap:10px;
            flex-wrap:wrap;
            margin-top:15px;
          "
        >

          <button
            class="btn secondary check-couriers"
            type="button"
          >
            🔍 Check Courier Rates
          </button>


          <button
            class="btn create-shipment"
            type="submit"
            disabled
          >
            Create Shipment
          </button>

        </div>


        <div
          class="courier-results"
          style="margin-top:15px;"
        ></div>


        <div
          class="shipment-result"
          style="margin-top:15px;"
        ></div>

      </form>

    </div>
  `;
}


/* =========================
   CHECK COURIER RATES
========================= */

async function checkCourierRates(
  form,
  order
) {

  if (!form.reportValidity()) {
    return;
  }


  const result =
    form.querySelector(
      '.courier-results'
    );


  const checkButton =
    form.querySelector(
      '.check-couriers'
    );


  const createButton =
    form.querySelector(
      '.create-shipment'
    );


  const body =
    Object.fromEntries(
      new FormData(form)
    );


  checkButton.disabled = true;

  checkButton.textContent =
    'Checking Couriers...';


  createButton.disabled = true;


  result.innerHTML =
    'Shiprocket se courier rates check ho rahe hain...';


  try {

    const data =
      await window.MC.api(
        '/admin/orders/' +
        order._id +
        '/check-couriers',
        {
          method: 'POST',

          body:
            JSON.stringify(body)
        }
      );


    const couriers =
      (data.couriers || [])
        .sort(
          (a, b) =>
            Number(a.rate || 0) -
            Number(b.rate || 0)
        );


    if (!couriers.length) {

      result.innerHTML = `
        <div class="message error">
          ❌ Is PIN code ke liye abhi koi courier available nahi mila.
        </div>
      `;

      return;
    }


    result.innerHTML = `

      <div class="message success">

        ✅ Courier available

        <br>

        Pickup PIN:
        <b>
          ${window.MC.esc(
            data.pickupPincode || ''
          )}
        </b>

        →

        Delivery PIN:
        <b>
          ${window.MC.esc(
            data.deliveryPincode || ''
          )}
        </b>

      </div>


      <div style="margin-top:12px;">

        ${couriers.map((courier, index) => {

          const rate =
            Number(
              courier.rate ||
              courier.freightCharge ||
              0
            );

          const delivery =
            courier.etd ||
            (
              courier.estimatedDeliveryDays
                ? courier.estimatedDeliveryDays +
                  ' days'
                : ''
            );

          return `

            <label
              class="admin-card"
              style="
                display:block;
                margin:10px 0;
                cursor:pointer;
              "
            >

              <input
                type="radio"
                name="courierCompanyId"
                value="${window.MC.esc(
                  courier.courierCompanyId || ''
                )}"
                ${index === 0 ? 'checked' : ''}
              >

              <b>
                ${window.MC.esc(
                  courier.courierName ||
                  'Courier'
                )}
              </b>

              <br>

              Shipping Charge:
              <b>
                ${window.MC.money(rate)}
              </b>

              ${
                courier.codCharges
                  ? `
                    <br>
                    COD Charge:
                    ${window.MC.money(
                      courier.codCharges
                    )}
                  `
                  : ''
              }

              ${
                delivery
                  ? `
                    <br>
                    Estimated Delivery:
                    ${window.MC.esc(
                      delivery
                    )}
                  `
                  : ''
              }

              ${
                courier.rating
                  ? `
                    <br>
                    Rating:
                    ${window.MC.esc(
                      courier.rating
                    )}
                  `
                  : ''
              }

            </label>

          `;

        }).join('')}

      </div>

    `;


    createButton.disabled = false;


    window.MC.toast(
      'Courier rates loaded.',
      'success'
    );


  } catch (error) {

    result.innerHTML = `

      <div class="message error">

        ❌
        ${window.MC.esc(
          error.message ||
          'Courier rate check failed.'
        )}

      </div>

    `;


    window.MC.toast(
      error.message ||
      'Courier rate check failed.',
      'error'
    );


  } finally {

    checkButton.disabled = false;

    checkButton.textContent =
      '🔍 Check Courier Rates';

  }

}


/* =========================
   CREATE SHIPMENT
========================= */

async function submitShipmentForm(
  form,
  order
) {

  if (!form.reportValidity()) {
    return;
  }


  const result =
    form.querySelector(
      '.shipment-result'
    );


  const submitButton =
    form.querySelector(
      '.create-shipment'
    );


  const body =
    Object.fromEntries(
      new FormData(form)
    );


  submitButton.disabled = true;

  submitButton.textContent =
    'Creating Shipment...';


  result.innerHTML =
    'Connecting to Shiprocket...';


  try {

    const data =
      await window.MC.api(
        '/admin/orders/' +
        order._id +
        '/create-shipment',
        {
          method: 'POST',

          body:
            JSON.stringify(body)
        }
      );


    const sr =
      data.shiprocket || {};


    result.innerHTML = `

      <div class="message success">

        ✅ Shiprocket order created successfully.

        <br><br>

        ${
          sr.order_id
            ? `
              <b>Shiprocket Order ID:</b>
              ${window.MC.esc(sr.order_id)}
              <br>
            `
            : ''
        }

        ${
          sr.shipment_id
            ? `
              <b>Shipment ID:</b>
              ${window.MC.esc(sr.shipment_id)}
              <br>
            `
            : ''
        }

        ${
          sr.status
            ? `
              <b>Status:</b>
              ${window.MC.esc(sr.status)}
            `
            : ''
        }

      </div>

    `;


    window.MC.toast(
      'Shiprocket order created.',
      'success'
    );


  } catch (error) {

    result.innerHTML = `

      <div class="message error">

        ❌
        ${window.MC.esc(
          error.message ||
          'Shipment creation failed.'
        )}

      </div>

    `;


    window.MC.toast(
      error.message ||
      'Shipment creation failed.',
      'error'
    );


  } finally {

    submitButton.disabled = false;

    submitButton.textContent =
      'Create Shipment';

  }

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

        <br>

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
            ? ', ' +
              window.MC.esc(address.state)
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


      ${shipmentFormHtml(order)}


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
        >
          🖨 Print Packaging Label
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


          if (!order || !detailsRow) {
            return;
          }


          detailsRow.innerHTML = `
            <td colspan="6">
              ${orderDetailsHtml(order)}
            </td>
          `;


          detailsRow.style.display =
            'table-row';


          const form =
            detailsRow.querySelector(
              '.shipment-form'
            );


          detailsRow
            .querySelector('.print-label')
            ?.addEventListener(
              'click',
              () => {
                printShippingLabel(order);
              }
            );


          form
            ?.querySelector(
              '.check-couriers'
            )
            ?.addEventListener(
              'click',
              () => {

                checkCourierRates(
                  form,
                  order
                );

              }
            );


          form
            ?.addEventListener(
              'submit',
              event => {

                event.preventDefault();

                submitShipmentForm(
                  event.currentTarget,
                  order
                );

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

                body:
                  JSON.stringify({
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
