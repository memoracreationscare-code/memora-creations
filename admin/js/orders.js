
/* =====================================================
   MEMORA CREATIONS - ADMIN ORDERS
   PREMIUM POPUP EDITION
   Existing order and Shiprocket functions preserved
===================================================== */

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

const mcEscape = value =>
  window.MC.esc(String(value ?? ''));

const mcMoney = value =>
  window.MC.money(Number(value || 0));


/* =====================================================
   PREMIUM SHIPROCKET CONFIRMATION POPUP
===================================================== */

function confirmShiprocketShipment() {
  return new Promise(resolve => {

    const previousFocus = document.activeElement;
    const overlay = document.createElement('div');

    overlay.className = 'mc-admin-popup-overlay';
    overlay.style.zIndex = '20000';

    overlay.innerHTML = `
      <div
        class="mc-admin-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mcShipmentTitle"
      >

        <div style="
          width:68px;
          height:68px;
          margin:0 auto 18px;
          display:flex;
          align-items:center;
          justify-content:center;
          border-radius:50%;
          background:#f6ede4;
          font-size:31px;
        ">🚚</div>

        <h2 id="mcShipmentTitle">
          Create Shipment?
        </h2>

        <p>
          You are about to create a real
          Shiprocket shipment and request
          an AWB tracking number.
        </p>

        <div style="
          background:#fff7ef;
          border:1px solid #f0dfcb;
          color:#805333;
          border-radius:12px;
          padding:13px;
          margin:17px 0;
          font-size:13px;
          line-height:1.6;
        ">
          Please verify the courier, package
          dimensions and delivery address
          before continuing.
        </div>

        <div class="mc-admin-popup-actions">

          <button
            type="button"
            id="mcShipmentCancel"
            style="
              flex:1;
              min-height:47px;
              border:0;
              border-radius:12px;
              background:#f1e9e1;
              color:#302117;
              font-weight:800;
              cursor:pointer;
            "
          >Cancel</button>

          <button
            type="button"
            id="mcShipmentConfirm"
            style="
              flex:1;
              min-height:47px;
              border:0;
              border-radius:12px;
              background:#8b5b3a;
              color:white;
              font-weight:800;
              cursor:pointer;
            "
          >Create Shipment</button>

        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const cancelButton =
      overlay.querySelector('#mcShipmentCancel');

    const confirmButton =
      overlay.querySelector('#mcShipmentConfirm');

    let completed = false;

    function finish(value) {
      if (completed) return;

      completed = true;

      document.removeEventListener(
        'keydown',
        handleKeydown
      );

      overlay.remove();

      if (previousFocus?.isConnected) {
        previousFocus.focus();
      }

      resolve(value);
    }

    function handleKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
      }

      if (event.key === 'Tab') {
        if (
          event.shiftKey &&
          document.activeElement === cancelButton
        ) {
          event.preventDefault();
          confirmButton.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === confirmButton
        ) {
          event.preventDefault();
          cancelButton.focus();
        }
      }
    }

    document.addEventListener(
      'keydown',
      handleKeydown
    );

    cancelButton.onclick = () => finish(false);
    confirmButton.onclick = () => finish(true);

    overlay.addEventListener('click', event => {
      if (event.target === overlay) {
        finish(false);
      }
    });

    cancelButton.focus();
  });
}


/* =====================================================
   PRINT PACKAGING LABEL
===================================================== */

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
      ? `COD ₹${Number(
          order.grandTotal || 0
        ).toLocaleString('en-IN')}`
      : 'PREPAID';

  const products = (order.items || [])
    .map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${mcEscape(item.name)}</td>
        <td>${Number(item.quantity || 0)}</td>
      </tr>
    `)
    .join('');

  const printWindow = window.open(
    '',
    '_blank',
    'width=700,height=900'
  );

  if (!printWindow) {
    window.MC.toast(
      'Please allow popups.',
      'error'
    );
    return;
  }

  printWindow.document.write(`
    <!doctype html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>
        Label - ${mcEscape(order.orderId)}
      </title>

      <style>
        @page {
          size:100mm 150mm;
          margin:4mm;
        }

        * {
          box-sizing:border-box;
        }

        body {
          margin:0;
          font-family:Arial,sans-serif;
          color:#000;
        }

        .label {
          width:92mm;
          min-height:140mm;
          margin:auto;
          padding:4mm;
          border:2px solid #000;
        }

        .brand {
          text-align:center;
          font-size:20px;
          font-weight:800;
          padding-bottom:8px;
          border-bottom:2px solid #000;
        }

        .payment {
          margin:8px 0;
          padding:8px;
          border:2px solid #000;
          text-align:center;
          font-size:20px;
          font-weight:900;
        }

        .section {
          padding:8px 0;
          border-bottom:1px solid #000;
          line-height:1.45;
          font-size:13px;
        }

        .title {
          font-size:11px;
          font-weight:800;
          text-transform:uppercase;
          margin-bottom:4px;
        }

        .name {
          font-size:16px;
          font-weight:800;
        }

        table {
          width:100%;
          border-collapse:collapse;
          font-size:11px;
        }

        th,td {
          border:1px solid #000;
          padding:5px;
        }

        .total {
          font-size:16px;
          font-weight:900;
        }

        .no-print {
          text-align:center;
          margin:15px;
        }

        @media print {
          .no-print {
            display:none;
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

          <div class="title">Order ID</div>

          <b>${mcEscape(order.orderId)}</b>

          <br>

          ${
            order.createdAt
              ? new Date(order.createdAt)
                  .toLocaleString('en-IN')
              : ''
          }

        </div>

        <div class="section">

          <div class="title">Ship To</div>

          <div class="name">
            ${mcEscape(customerName)}
          </div>

          ${mcEscape(address.addressLine)}

          <br>

          ${mcEscape(address.city)}

          ${
            address.state
              ? ', ' + mcEscape(address.state)
              : ''
          }

          <br>

          <b>
            PIN: ${mcEscape(address.pinCode)}
          </b>

          <br>

          Mobile:
          <b>${mcEscape(mobile)}</b>

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
          <b>${mcEscape(order.paymentMethod)}</b>

          <br>

          Payment Status:
          <b>${mcEscape(order.paymentStatus)}</b>

          <br><br>

          <div class="total">
            Total:
            ₹${Number(
              order.grandTotal || 0
            ).toLocaleString('en-IN')}
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

  printWindow.document.close();
}


/* =====================================================
   SHIPROCKET FORM
===================================================== */

function shipmentFormHtml(order) {

  return `
    <div
      class="admin-card shipment-box"
      style="margin-top:20px;"
    >

      <h3>🚚 Shiprocket Shipping</h3>

      <p class="mini">
        Customer, address, PIN, products aur
        payment details automatic rahengi.
        Sirf package ka weight aur size bharo.
      </p>

      <form
        class="shipment-form"
        data-id="${mcEscape(order._id)}"
      >

        <div class="formgrid">

          <div class="field">
            <label>Weight (KG)</label>
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
            <label>Length (CM)</label>
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
            <label>Width (CM)</label>
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
            <label>Height (CM)</label>
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
            <label>Pickup Location</label>
            <input
              class="input"
              name="pickupLocation"
              value="Home"
              required
            >
          </div>

        </div>

        <div style="
          display:flex;
          gap:10px;
          flex-wrap:wrap;
          margin-top:15px;
        ">

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
            Create Shipment + AWB
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


/* =====================================================
   CHECK COURIER RATES
===================================================== */

async function checkCourierRates(form, order) {

  if (!form.reportValidity()) {
    return;
  }

  const result =
    form.querySelector('.courier-results');

  const checkButton =
    form.querySelector('.check-couriers');

  const createButton =
    form.querySelector('.create-shipment');

  const body = Object.fromEntries(
    new FormData(form)
  );

  checkButton.disabled = true;

  checkButton.textContent =
    'Checking Couriers...';

  createButton.disabled = true;

  result.textContent =
    'Shiprocket se courier rates check ho rahe hain...';

  try {

    const data = await window.MC.api(
      '/admin/orders/' +
      order._id +
      '/check-couriers',
      {
        method: 'POST',
        body: JSON.stringify(body)
      }
    );

    const couriers = (data.couriers || [])
      .sort((a, b) =>
        Number(a.rate || 0) -
        Number(b.rate || 0)
      );

    if (!couriers.length) {

      result.innerHTML = `
        <div class="message error">
          ❌ Is route ke liye koi courier
          available nahi mila.
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
          ${mcEscape(data.pickupPincode)}
        </b>

        →

        Delivery PIN:
        <b>
          ${mcEscape(data.deliveryPincode)}
        </b>

      </div>

      <div style="margin-top:12px;">

        ${couriers.map((courier, index) => {

          const rate = Number(
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
                value="${mcEscape(
                  courier.courierCompanyId
                )}"
                ${index === 0 ? 'checked' : ''}
              >

              <b>
                ${mcEscape(
                  courier.courierName || 'Courier'
                )}
              </b>

              <br>

              Shipping Charge:
              <b>${mcMoney(rate)}</b>

              ${
                courier.codCharges
                  ? `
                    <br>
                    COD Charge:
                    ${mcMoney(courier.codCharges)}
                  `
                  : ''
              }

              ${
                delivery
                  ? `
                    <br>
                    Estimated Delivery:
                    ${mcEscape(delivery)}
                  `
                  : ''
              }

              ${
                courier.rating
                  ? `
                    <br>
                    Rating:
                    ${mcEscape(courier.rating)}
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
        ❌ ${mcEscape(
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


/* =====================================================
   CREATE SHIPMENT + AWB
===================================================== */

async function submitShipmentForm(form, order) {

  if (!form.reportValidity()) {
    return;
  }

  const result =
    form.querySelector('.shipment-result');

  const submitButton =
    form.querySelector('.create-shipment');

  const body = Object.fromEntries(
    new FormData(form)
  );

  if (!body.courierCompanyId) {

    window.MC.toast(
      'Please select a courier first.',
      'error'
    );

    return;
  }

  // PREMIUM CONFIRMATION:
  // No API call unless admin explicitly confirms.

  const confirmed =
    await confirmShiprocketShipment();

  if (!confirmed) {
    return;
  }

  submitButton.disabled = true;

  submitButton.textContent =
    'Creating Shipment...';

  result.textContent =
    'Creating shipment and generating AWB...';

  try {

    const data = await window.MC.api(
      '/admin/orders/' +
      order._id +
      '/create-shipment',
      {
        method: 'POST',
        body: JSON.stringify(body)
      }
    );

    const sr =
      data.shiprocketOrder || {};

    const awb =
      data.awb || {};

    result.innerHTML = `

      <div class="message success">

        ✅ Shipment created successfully.

        <br><br>

        ${
          sr.order_id
            ? `
              <b>Shiprocket Order ID:</b>
              ${mcEscape(sr.order_id)}
              <br>
            `
            : ''
        }

        ${
          sr.shipment_id
            ? `
              <b>Shipment ID:</b>
              ${mcEscape(sr.shipment_id)}
              <br>
            `
            : ''
        }

        ${
          awb.courierName
            ? `
              <b>Courier:</b>
              ${mcEscape(awb.courierName)}
              <br>
            `
            : ''
        }

        ${
          awb.awbCode
            ? `
              <b>AWB / Tracking Number:</b>
              ${mcEscape(awb.awbCode)}
              <br>
            `
            : ''
        }

        <br>

        ${
          awb.awbCode
            ? `
              <b>
                ✅ Tracking number generated
                successfully.
              </b>
            `
            : `
              <b>
                ⚠️ Shipment created but AWB
                number was not returned.
              </b>
            `
        }

      </div>
    `;

    window.MC.toast(
      awb.awbCode
        ? 'Shipment and AWB created successfully.'
        : 'Shipment created.',
      'success'
    );

  } catch (error) {

    result.innerHTML = `
      <div class="message error">
        ❌ ${mcEscape(
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
      'Create Shipment + AWB';

  }
}


/* =====================================================
   ORDER DETAILS
===================================================== */

function orderDetailsHtml(order) {

  const address = order.shippingAddress || {};

  const items = (order.items || [])
    .map(item => `

      <div
        class="admin-card"
        style="margin:10px 0;"
      >

        <div style="
          display:flex;
          gap:15px;
          align-items:center;
          flex-wrap:wrap;
        ">

          ${
            item.imageUrl
              ? `
                <img
                  src="${mcEscape(item.imageUrl)}"
                  alt="Product"
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

          <div style="flex:1;min-width:150px;">

            <b>${mcEscape(item.name)}</b>

            <div class="mini">
              Product ID:
              ${mcEscape(item.productId)}
            </div>

            <div>
              Qty:
              ${Number(item.quantity || 0)}
            </div>

            <div>
              Price:
              ${mcMoney(item.unitPrice)}
            </div>

          </div>

          <b>
            ${mcMoney(item.lineTotal)}
          </b>

        </div>
      </div>

    `)
    .join('');

  const history = (order.statusHistory || [])
    .map(item => `

      <div style="margin-bottom:10px;">

        <b>${mcEscape(item.status)}</b>

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
            ? `<div>${mcEscape(item.note)}</div>`
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

      <h2>Order Details</h2>

      <p>

        <b>Order ID:</b>
        ${mcEscape(order.orderId)}

        <br>

        <b>Customer:</b>
        ${mcEscape(
          order.customer?.fullName ||
          order.user?.fullName
        )}

        <br>

        <b>Mobile:</b>
        ${mcEscape(
          order.customer?.mobile ||
          order.user?.mobile
        )}

        <br>

        <b>Email:</b>
        ${mcEscape(
          order.customer?.email ||
          order.user?.email
        )}

      </p>

      <h3>Delivery Address</h3>

      <p>

        ${mcEscape(address.fullName)}

        <br>

        ${mcEscape(address.addressLine)}

        <br>

        ${mcEscape(address.city)}

        ${
          address.state
            ? ', ' + mcEscape(address.state)
            : ''
        }

        <br>

        PIN:
        ${mcEscape(address.pinCode)}

        <br>

        Mobile:
        ${mcEscape(address.mobile)}

      </p>

      <h3>Products</h3>

      ${
        items || '<p>No products found.</p>'
      }

      <h3>Payment & Total</h3>

      <p>

        <b>Payment Method:</b>
        ${mcEscape(order.paymentMethod)}

        <br>

        <b>Payment Status:</b>
        ${mcEscape(order.paymentStatus)}

        <br>

        <b>Order Status:</b>
        ${mcEscape(order.orderStatus)}

      </p>

      <p>

        Subtotal:
        <b>${mcMoney(order.subtotal)}</b>

        <br>

        Delivery:
        <b>${mcMoney(order.deliveryCharge)}</b>

        <br>

        You Save:
        <b>${mcMoney(order.discount)}</b>

        <br>

        Total:
        <b>${mcMoney(order.grandTotal)}</b>

      </p>

      <h3>Status History</h3>

      ${
        history ||
        '<p>No status history.</p>'
      }

      ${shipmentFormHtml(order)}

      <div style="
        display:flex;
        gap:10px;
        flex-wrap:wrap;
        margin-top:15px;
      ">

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


/* =====================================================
   BIND ORDER BUTTONS
===================================================== */

function bindOrderButtons() {

  document
    .querySelectorAll('.view-order')
    .forEach(button => {

      button.addEventListener('click', () => {

        const id = button.dataset.id;

        const order = adminOrders.find(
          item => item._id === id
        );

        const detailsRow =
          document.getElementById(
            'details-' + id
          );

        if (!order || !detailsRow) {
          return;
        }

        detailsRow.innerHTML = `
          <td colspan="6">
            ${orderDetailsHtml(order)}
          </td>
        `;

        detailsRow.style.display = 'table-row';

        const form =
          detailsRow.querySelector(
            '.shipment-form'
          );

        detailsRow
          .querySelector('.print-label')
          ?.addEventListener('click', () => {
            printShippingLabel(order);
          });

        form
          ?.querySelector('.check-couriers')
          ?.addEventListener('click', () => {
            checkCourierRates(form, order);
          });

        form?.addEventListener(
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
          ?.addEventListener('click', () => {

            detailsRow.style.display = 'none';

          });

      });
    });


  /* ORDER STATUS CHANGE */

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
                  orderStatus: select.value
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


/* =====================================================
   LOAD ORDERS
===================================================== */

async function loadAdminOrders() {

  const admin =
    await window.requireAdmin();

  if (!admin) return;

  const search =
    document.querySelector('#search')
      ?.value || '';

  const ordersBox =
    document.querySelector('#orders');

  if (!ordersBox) return;

  try {

    const data = await window.MC.api(
      '/admin/orders?search=' +
      encodeURIComponent(search)
    );

    adminOrders = data.orders || [];

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

    ordersBox.innerHTML = adminOrders
      .map(order => `

        <tr>

          <td>

            <b>
              ${mcEscape(order.orderId)}
            </b>

            <br>

            <span class="mini">

              ${
                order.createdAt
                  ? new Date(order.createdAt)
                      .toLocaleString('en-IN')
                  : ''
              }

            </span>

            <br><br>

            <button
              class="btn secondary view-order"
              type="button"
              data-id="${mcEscape(order._id)}"
            >
              View Details
            </button>

          </td>

          <td>

            ${mcEscape(
              order.user?.fullName ||
              order.customer?.fullName ||
              'Guest'
            )}

            <br>

            ${mcEscape(
              order.user?.mobile ||
              order.customer?.mobile
            )}

          </td>

          <td>
            ${mcMoney(order.grandTotal)}
          </td>

          <td>

            ${mcEscape(order.paymentMethod)}

            <br>

            <span class="mini">
              ${mcEscape(order.paymentStatus)}
            </span>

          </td>

          <td>
            ${mcEscape(order.orderStatus)}
          </td>

          <td>

            <select
              class="select order-status"
              data-id="${mcEscape(order._id)}"
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
          id="details-${mcEscape(order._id)}"
          style="display:none;"
        ></tr>

      `)
      .join('');

    bindOrderButtons();

  } catch (error) {

    window.MC.toast(
      error.message ||
      'Orders load failed.',
      'error'
    );

  }
}


/* =====================================================
   SEARCH BUTTON
===================================================== */

document
  .querySelector('#searchBtn')
  ?.addEventListener(
    'click',
    loadAdminOrders
  );


/* =====================================================
   SEARCH USING ENTER
===================================================== */

document
  .querySelector('#search')
  ?.addEventListener(
    'keydown',
    event => {

      if (event.key === 'Enter') {
        event.preventDefault();
        loadAdminOrders();
      }

    }
  );


/* =====================================================
   START ORDERS PAGE
===================================================== */

loadAdminOrders();
