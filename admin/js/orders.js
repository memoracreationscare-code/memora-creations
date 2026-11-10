
/*
=========================================
 MEMORA CREATIONS
 ADMIN ORDERS MANAGEMENT

 CASHFREE PAYMENT REFERENCES
 RAZORPAY REFERENCES
 ORDER DETAILS
 STATUS UPDATE
 SHIPROCKET COURIER RATES
 SHIPMENT CREATION + AWB
 PACKAGING LABEL

 FIX: BREADTH -> WIDTH
=========================================
*/

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

const mcApi = (path, options) =>
  window.MC.api(path, options);


/* =====================================
   DISPLAY HELPERS
===================================== */

function displayValue(value) {
  return value === undefined ||
    value === null ||
    value === ''
      ? 'Not Available'
      : String(value);
}

function formatDate(value) {
  if (!value) return '-';

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '-'
    : date.toLocaleString('en-IN');
}

function notify(message, type = 'success') {
  window.MC.toast(message, type);
}

function onlinePaymentDetailsHtml(order) {

  const d = order.paymentDetails || {};
  const has = d.method || d.upiId || d.bankReference;
  const row = (label, value) => value
    ? `<p><b>${label}:</b> ${mcEscape(String(value))}</p>`
    : '';

  const paidAt = d.paidAt
    ? new Date(d.paidAt).toLocaleString('en-IN')
    : '';

  const card = d.cardLast4
    ? [d.cardNetwork, '•••• ' + d.cardLast4].filter(Boolean).join(' ')
    : '';

  return `
    <div style="margin:10px 0;padding:12px;background:#fff;border-radius:10px;
      border:1px solid #eadfd3">
      <b>Online payment details</b>
      ${has ? `
        ${row('Payment method', d.method)}
        ${row('UPI ID (payer)', d.upiId)}
        ${row('UPI app', d.upiChannel)}
        ${row('UTR / Bank reference', d.bankReference)}
        ${row('Bank', d.bankName)}
        ${row('Card', card)}
        ${row('Wallet / app', d.appProvider)}
        ${row('Amount paid', d.amount != null ? mcMoney(d.amount) : '')}
        ${row('Paid at', paidAt)}
      ` : `
        <p style="color:#805333">
          Details not saved yet
          ${order.paymentStatus === 'SUCCESS'
            ? '(older order). Press the button below to fetch them from Cashfree.'
            : '(payment not completed).'}
        </p>`}
      ${order.paymentStatus === 'SUCCESS' ? `
        <button type="button" class="btn secondary refresh-payment"
          data-id="${mcEscape(String(order._id))}">
          Refresh payment details
        </button>` : ''}
    </div>
  `;
}

function refundHtml(order) {

  const r = order.refund;

  if (!r || !r.status) return '';

  return `
    <p style="padding:10px;border-radius:10px;background:#fff7e6">
      <b>${r.status === 'REFUNDED' ? 'Refunded' : 'Refund processing'}:</b>
      ${mcEscape(mcMoney(r.amount))} (read from Cashfree)
    </p>
  `;
}

function autoCancelHtml(order) {

  const a = order.autoCancel;

  if (!a || !a.at) return '';

  const bad = a.refundStatus === 'FAILED' || a.shiprocket === 'FAILED';

  return `
    <p style="padding:10px;border-radius:10px;background:${bad ? '#fff1f0' : '#eef8ee'}">
      <b>Cancelled automatically</b>
      ${a.shiprocket === 'CANCELLED' ? ' · Shiprocket order cancelled' : ''}
      ${a.refundStatus === 'SUBMITTED' ? ' · refund of ' + mcMoney(a.refundAmount) + ' sent to Cashfree' : ''}
      ${a.refundStatus === 'FAILED' ? ' · <b>refund FAILED, refund by hand in Cashfree</b>' : ''}
      ${a.shiprocket === 'FAILED' ? ' · <b>Shiprocket cancel FAILED, cancel by hand</b>' : ''}
    </p>
  `;
}

function paymentReferenceHtml(order) {

  if (order.paymentMethod === 'CASHFREE') {

    return `
      <div class="admin-card"
        style="margin-top:15px;padding:18px;
        background:#faf6f2;overflow-wrap:anywhere">

        <h3>Cashfree Payment References</h3>

        <p>
          <b>Cashfree Order ID:</b>
          ${mcEscape(displayValue(order.cashfreeOrderId))}
        </p>

        <p>
          <b>Cashfree CF Order ID:</b>
          ${mcEscape(displayValue(order.cashfreeCfOrderId))}
        </p>

        <p>
          <b>Cashfree Payment ID:</b>
          ${mcEscape(displayValue(order.cashfreePaymentId))}
        </p>

        ${onlinePaymentDetailsHtml(order)}

        ${autoCancelHtml(order)}

        ${refundHtml(order)}

        <p>
          <b>Payment Status:</b>
          ${mcEscape(order.paymentStatus)}
        </p>

        <p>
          <b>Stock Reserved:</b>
          ${order.stockReserved === true ? 'YES' : 'NO'}
        </p>

        ${order.codAdvance?.enabled ? `
        <p style="padding:10px;background:#fff6ec;border-radius:10px">
          <b>COD with advance:</b>
          advance ${mcMoney(order.codAdvance.advanceAmount)} paid online,
          courier collects <b>${mcMoney(order.codAdvance.balanceAmount)}</b> cash
          (${order.codAdvance.balanceStatus === 'RECEIVED' ? 'balance received' : 'balance pending'}).
          Mark the balance received from the COD Remittance page.
        </p>` : ''}
        <p style="font-size:12px;color:#805333">
          Verify payment status in Cashfree
          before processing any unpaid order.
          A pending payment is not a failed payment.
        </p>

      </div>
    `;
  }

  if (order.paymentMethod === 'RAZORPAY') {

    return `
      <div class="admin-card"
        style="margin-top:15px;padding:18px;
        background:#faf6f2;overflow-wrap:anywhere">

        <h3>Razorpay Payment References</h3>

        <p>
          <b>Razorpay Order ID:</b>
          ${mcEscape(displayValue(order.razorpayOrderId))}
        </p>

        <p>
          <b>Razorpay Payment ID:</b>
          ${mcEscape(displayValue(order.razorpayPaymentId))}
        </p>

      </div>
    `;
  }

  return `
    <div class="admin-card"
      style="margin-top:15px;padding:18px">
      <h3>Cash on Delivery</h3>
      <p>
        Payment Status:
        <b>${mcEscape(order.paymentStatus)}</b>
      </p>
    </div>
  `;
}


/* =====================================
   CHECK ORDER IS READY FOR SHIPMENT
===================================== */

function canCreateShipment(order) {

  if (
    order.orderStatus === 'Cancelled' ||
    order.orderStatus === 'Delivered'
  ) {
    return false;
  }

  if (order.paymentMethod === 'COD') {
    return order.paymentStatus === 'COD_PENDING';
  }

  return order.paymentStatus === 'SUCCESS';
}


/* =====================================
   SHIPROCKET CONFIRMATION
===================================== */

function confirmShiprocketShipment() {

  return new Promise(resolve => {

    const previousFocus = document.activeElement;

    const overlay = document.createElement('div');
    overlay.className = 'mc-admin-popup-overlay';

    overlay.style.cssText = `
      position:fixed;
      inset:0;
      z-index:20000;
      background:rgba(0,0,0,.6);
      display:flex;
      justify-content:center;
      align-items:center;
      padding:20px;
    `;

    overlay.innerHTML = `
      <div role="dialog"
        aria-modal="true"
        aria-labelledby="shipmentConfirmTitle"
        style="
          max-width:430px;
          width:100%;
          background:white;
          padding:28px;
          border-radius:20px;
          text-align:center;
          box-shadow:0 15px 60px #0003;
        ">

        <div style="font-size:40px">🚚</div>

        <h2 id="shipmentConfirmTitle">
          Create Shipment?
        </h2>

        <p>
          You are about to create a
          Shiprocket shipment.
        </p>

        <p style="
          padding:12px;
          background:#fff6ec;
          border-radius:10px;
          font-size:13px;
        ">
          Please confirm courier,
          weight, dimensions and delivery address.
        </p>

        <div style="
          display:flex;
          gap:10px;
          margin-top:20px;
        ">

          <button
            type="button"
            class="shipment-cancel"
            style="flex:1;padding:14px;
            border:0;border-radius:10px">
            Cancel
          </button>

          <button
            type="button"
            class="shipment-confirm"
            style="flex:1;padding:14px;
            border:0;border-radius:10px;
            background:#946343;color:white">
            Create Shipment
          </button>

        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const cancelButton =
      overlay.querySelector('.shipment-cancel');

    const confirmButton =
      overlay.querySelector('.shipment-confirm');

    let finished = false;

    function done(value) {

      if (finished) return;

      finished = true;

      document.removeEventListener(
        'keydown',
        onKeydown
      );

      overlay.remove();

      if (previousFocus?.isConnected) {
        previousFocus.focus();
      }

      resolve(value);
    }

    function onKeydown(event) {

      if (event.key === 'Escape') {
        done(false);
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

    cancelButton.onclick = () => done(false);
    confirmButton.onclick = () => done(true);

    overlay.onclick = event => {
      if (event.target === overlay) done(false);
    };

    document.addEventListener(
      'keydown',
      onKeydown
    );

    cancelButton.focus();
  });
}


/* =====================================
   PRINT PACKAGING LABEL
===================================== */

function printShippingLabel(order) {

  const address = order.shippingAddress || {};

  const customer =
    order.customer?.fullName ||
    order.user?.fullName ||
    address.fullName ||
    'Customer';

  const mobile =
    order.customer?.mobile ||
    address.mobile ||
    '';

  const products = (order.items || [])
    .map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${mcEscape(item.name)}</td>
        <td>${Number(item.quantity || 0)}</td>
      </tr>
    `)
    .join('');

  const paymentText =
    order.codAdvance?.enabled
      ? `COD: ${mcMoney(order.codAdvance.balanceAmount)} (advance ${mcMoney(order.codAdvance.advanceAmount)} paid online)`
      : order.paymentMethod === 'COD'
      ? `COD: ${mcMoney(order.grandTotal)}`
      : 'PREPAID';

  const label = `
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Packaging Label</title>
      <style>
        body {
          font-family:Arial,sans-serif;
          padding:22px;
          color:#111;
        }
        h2 {text-align:center}
        .box {
          border:2px solid #222;
          padding:15px;
          margin:15px 0;
        }
        table {
          width:100%;
          border-collapse:collapse;
        }
        td,th {
          border:1px solid #555;
          padding:9px;
          text-align:left;
        }
        @media print {
          button {display:none}
        }
      </style>
    </head>
    <body>
      <h2>MEMORA CREATIONS</h2>
      <h3>Shipping / Packaging Label</h3>

      <div class="box">
        <p><b>Order:</b>
          ${mcEscape(order.orderId)}
        </p>
        <p><b>Customer:</b>
          ${mcEscape(customer)}
        </p>
        <p><b>Mobile:</b>
          ${mcEscape(mobile)}
        </p>
        <p><b>Address:</b>
          ${mcEscape(address.addressLine)}
        </p>
        <p>
          ${mcEscape(address.city)},
          ${mcEscape(address.state)}
        </p>
        <p><b>PIN:</b>
          ${mcEscape(address.pinCode)}
        </p>
        <p><b>Payment:</b>
          ${mcEscape(paymentText)}
        </p>
      </div>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Product</th>
            <th>Quantity</th>
          </tr>
        </thead>
        <tbody>${products}</tbody>
      </table>
    </body>
    </html>
  `;

  const blob = new Blob(
    [label],
    { type: 'text/html' }
  );

  const url = URL.createObjectURL(blob);

  const printWindow = window.open(
    url,
    '_blank'
  );

  if (!printWindow) {
    URL.revokeObjectURL(url);
    notify('Please allow print popup.', 'error');
    return;
  }

  printWindow.addEventListener(
    'load',
    () => {
      printWindow.focus();
      printWindow.print();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    },
    { once: true }
  );
}


/* =====================================
   SHIPMENT FORM
===================================== */

function shipmentFormHtml(order) {

  if (!canCreateShipment(order)) {
    return `
      <div class="admin-card"
        style="padding:18px;margin:15px 0;
        background:#fff7ed">

        <b>Shipment unavailable</b>

        <p>
          Online payment must be SUCCESS
          before shipment creation.
          COD orders must be eligible.
        </p>

      </div>
    `;
  }

  return `
    <div class="admin-card"
      style="margin-top:20px;padding:20px">

      <h3>🚚 Shiprocket Shipment</h3>

      <p class="mini">
        Check courier rates before creating
        a shipment.
      </p>

      <form class="shipment-form">

        <div style="
          display:grid;
          grid-template-columns:
          repeat(auto-fit,minmax(150px,1fr));
          gap:12px;
        ">

          <div class="field">
            <label>Weight (KG)</label>
            <input
              class="input"
              name="weight"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.5"
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
              placeholder="25"
              required
            >
          </div>

          <div class="field">
            <label>Breadth (CM)</label>
            <input
              class="input"
              name="breadth"
              type="number"
              step="0.1"
              min="0.1"
              placeholder="20"
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
              placeholder="8"
              required
            >
          </div>

          <div class="field">
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
          margin-top:16px;
        ">

          <button
            class="btn secondary check-couriers"
            type="button">
            🔍 Check Courier Rates
          </button>

          <button
            class="btn create-shipment"
            type="submit"
            disabled>
            Create Shipment + AWB
          </button>

        </div>

        <div class="courier-results"
          style="margin-top:15px"></div>

        <div class="shipment-result"
          style="margin-top:15px"></div>

      </form>

    </div>
  `;
}


/* =====================================
   SHIPMENT PAYLOAD

   FIX:
   HTML form uses "breadth".
   Backend expects "width".

   Both courier check and shipment
   creation use the same payload.
===================================== */

function getShipmentPayload(form) {

  const body = Object.fromEntries(
    new FormData(form)
  );

  body.width = body.breadth;

  delete body.breadth;

  return body;
}


/* =====================================
   CHECK COURIER RATES
===================================== */

async function checkCourierRates(form, order) {

  if (!form.reportValidity()) return;

  if (!canCreateShipment(order)) {
    notify(
      'Payment not confirmed for shipment.',
      'error'
    );
    return;
  }

  const result =
    form.querySelector('.courier-results');

  const checkButton =
    form.querySelector('.check-couriers');

  const createButton =
    form.querySelector('.create-shipment');

  const body = getShipmentPayload(form);

  checkButton.disabled = true;
  createButton.disabled = true;

  checkButton.textContent =
    'Checking Couriers...';

  result.textContent =
    'Loading Shiprocket courier rates...';

  try {

    const data = await mcApi(
      '/admin/orders/' +
      order._id +
      '/check-couriers',
      {
        method: 'POST',
        body: JSON.stringify(body)
      }
    );

    const couriers =
      Array.isArray(data.couriers)
        ? data.couriers
        : [];

    couriers.sort(
      (a, b) =>
        Number(a.rate || 0) -
        Number(b.rate || 0)
    );

    if (!couriers.length) {

      result.textContent =
        'No couriers available for this address.';

      return;
    }

    result.innerHTML = `
      <div class="message success">
        Courier rates loaded.
      </div>

      ${couriers.map((courier, index) => {

        const rate = Number(
          courier.rate ||
          courier.freightCharge ||
          0
        );

        return `
          <label class="admin-card"
            style="
              display:block;
              margin:10px 0;
              padding:14px;
              cursor:pointer;
            ">

            <input
              type="radio"
              name="courierCompanyId"
              value="${mcEscape(courier.courierCompanyId)}"
              ${index === 0 ? 'checked' : ''}
            >

            <b>
              ${mcEscape(
                courier.courierName || 'Courier'
              )}
            </b>

            <p>
              Shipping Charge:
              ${mcMoney(rate)}
            </p>

            ${courier.codCharges
              ? `<p>COD Charge:
                  ${mcMoney(courier.codCharges)}
                 </p>`
              : ''
            }

            ${courier.etd
              ? `<p>Delivery:
                  ${mcEscape(courier.etd)}
                 </p>`
              : ''
            }

          </label>
        `;

      }).join('')}
    `;

    createButton.disabled = false;

    notify(
      'Courier rates loaded.',
      'success'
    );

  } catch (err) {

    result.textContent =
      err.message || 'Courier check failed.';

    notify(
      err.message || 'Courier check failed.',
      'error'
    );

  } finally {

    checkButton.disabled = false;
    checkButton.textContent =
      '🔍 Check Courier Rates';

  }
}


/* =====================================
   CREATE SHIPMENT
===================================== */

async function submitShipmentForm(form, order) {

  if (!form.reportValidity()) return;

  if (!canCreateShipment(order)) {
    notify(
      'This order is not ready for shipment.',
      'error'
    );
    return;
  }

  const selectedCourier =
    form.querySelector(
      'input[name="courierCompanyId"]:checked'
    );

  if (!selectedCourier) {
    notify(
      'Please select a courier.',
      'error'
    );
    return;
  }

  const confirmed =
    await confirmShiprocketShipment();

  if (!confirmed) return;

  const button =
    form.querySelector('.create-shipment');

  const result =
    form.querySelector('.shipment-result');

  const body = getShipmentPayload(form);

  button.disabled = true;
  button.textContent = 'Creating Shipment...';

  result.textContent =
    'Creating shipment with Shiprocket...';

  try {

    const data = await mcApi(
      '/admin/orders/' +
      order._id +
      '/create-shipment',
      {
        method: 'POST',
        body: JSON.stringify(body)
      }
    );

    const shipment =
      data.shiprocketOrder || {};

    const awb =
      data.awb || {};

    result.innerHTML = `
      <div class="message success">

        <b>Shipment created.</b>

        <p>
          Shiprocket Order ID:
          ${mcEscape(
            displayValue(shipment.order_id)
          )}
        </p>

        <p>
          Shipment ID:
          ${mcEscape(
            displayValue(shipment.shipment_id)
          )}
        </p>

        <p>
          Courier:
          ${mcEscape(
            displayValue(awb.courierName)
          )}
        </p>

        <p>
          AWB:
          ${mcEscape(
            displayValue(awb.awbCode)
          )}
        </p>

      </div>
    `;

    notify(
      awb.awbCode
        ? 'Shipment and AWB created.'
        : 'Shipment created. Check AWB.',
      'success'
    );

    // Prevent accidental repeat submission.
    button.textContent =
      'Shipment Request Sent';

  } catch (err) {

    result.textContent =
      err.message || 'Shipment creation failed.';

    button.disabled = false;
    button.textContent =
      'Create Shipment + AWB';

    notify(
      err.message || 'Shipment failed.',
      'error'
    );

  }
}


/* =====================================
   ORDER DETAILS
===================================== */

function orderDetailsHtml(order) {

  const address =
    order.shippingAddress || {};

  const items = (order.items || [])
    .map(item => `
      <div class="admin-card"
        style="padding:15px;margin:10px 0">

        <div style="
          display:flex;
          align-items:center;
          flex-wrap:wrap;
          gap:15px;
        ">

          ${item.imageUrl
            ? `<img
                 src="${mcEscape(item.imageUrl)}"
                 alt="Product"
                 width="70"
                 height="70"
                 style="object-fit:cover;
                 border-radius:10px">`
            : ''
          }

          <div style="flex:1">

            <b>${mcEscape(item.name)}</b>

            <p class="mini">
              Product ID:
              ${mcEscape(item.productId)}
            </p>

            <p>
              Quantity:
              ${Number(item.quantity || 0)}
            </p>

            <p>
              Unit Price:
              ${mcMoney(item.unitPrice)}
            </p>

          </div>

          <b>${mcMoney(item.lineTotal)}</b>

        </div>

      </div>
    `)
    .join('');

  const history = (order.statusHistory || [])
    .map(item => `
      <div style="margin:10px 0">

        <b>${mcEscape(item.status)}</b>

        <div class="mini">
          ${formatDate(item.changedAt)}
        </div>

        <div>
          ${mcEscape(item.note || '')}
        </div>

      </div>
    `)
    .join('');

  return `
    <div class="admin-card"
      style="padding:22px;margin:12px 0">

      <h2>Order Details</h2>

      <p>
        <b>Order ID:</b>
        ${mcEscape(order.orderId)}
      </p>

      <p>
        <b>Customer:</b>
        ${mcEscape(
          order.customer?.fullName ||
          order.user?.fullName ||
          'Customer'
        )}
      </p>

      <p>
        <b>Mobile:</b>
        ${mcEscape(
          order.customer?.mobile ||
          order.user?.mobile ||
          ''
        )}
      </p>

      <p>
        <b>Email:</b>
        ${mcEscape(
          order.customer?.email ||
          order.user?.email ||
          ''
        )}
      </p>

      <h3>Delivery Address</h3>

      <p>
        ${mcEscape(address.fullName)}
      </p>

      <p>
        ${mcEscape(address.addressLine)}
      </p>

      <p>
        ${mcEscape(address.city)}
        ${address.state
          ? ', ' + mcEscape(address.state)
          : ''
        }
      </p>

      <p>
        PIN:
        ${mcEscape(address.pinCode)}
      </p>

      <p>
        Mobile:
        ${mcEscape(address.mobile)}
      </p>

      <h3>Products</h3>

      ${items || '<p>No products.</p>'}

      <h3>Payment & Total</h3>

      <p>
        <b>Payment Method:</b>
        ${mcEscape(order.paymentMethod)}
      </p>

      <p>
        <b>Payment Status:</b>
        ${mcEscape(order.paymentStatus)}
      </p>

      <p>
        <b>Order Status:</b>
        ${mcEscape(order.orderStatus)}
      </p>

      <p>
        Subtotal:
        ${mcMoney(order.subtotal)}
      </p>

      <p>
        Delivery:
        ${mcMoney(order.deliveryCharge)}
      </p>

      <p>
        You Save:
        ${mcMoney(order.discount)}
      </p>

      <p>
        <b>Total:
          ${mcMoney(order.grandTotal)}
        </b>
      </p>

      <!-- CASHFREE / RAZORPAY REFERENCES -->

      ${paymentReferenceHtml(order)}

      <h3>📝 Private note (sirf aapko dikhega)</h3>

      <textarea
        class="input admin-note"
        rows="3"
        maxlength="1000"
        placeholder="Jaise: customer ne call kiya, Sunday ke baad delivery chahiye"
        style="width:100%;box-sizing:border-box"
      >${mcEscape(order.adminNote?.text || '')}</textarea>

      <p style="margin:8px 0 18px">
        <button class="btn secondary save-note" type="button">Note save karo</button>
      </p>

      <h3>Status History</h3>

      ${history || '<p>No status history.</p>'}

      <!-- SHIPROCKET -->

      ${shipmentFormHtml(order)}

      <div style="
        display:flex;
        flex-wrap:wrap;
        gap:10px;
        margin-top:18px;
      ">

        <button
          class="btn print-label"
          type="button">
          🖨 Print Packaging Label
        </button>

        <button
          class="btn secondary close-details"
          type="button">
          Close Details
        </button>

      </div>

    </div>
  `;
}


/* =====================================
   VIEW ORDER
===================================== */

function openOrderDetails(id) {

  const order = adminOrders.find(
    item => String(item._id) === String(id)
  );

  const detailsRow = document.getElementById(
    'details-' + id
  );

  if (!order || !detailsRow) return;

  detailsRow.innerHTML = `
    <td colspan="6">
      ${orderDetailsHtml(order)}
    </td>
  `;

  detailsRow.style.display = 'table-row';

  detailsRow
    .querySelector('.save-note')
    ?.addEventListener('click', async event => {

      const button = event.currentTarget;
      const text = detailsRow.querySelector('.admin-note').value;

      button.disabled = true;

      try {
        const result = await mcApi(
          '/admin/orders/' + encodeURIComponent(order._id) + '/note',
          {
            method: 'PUT',
            body: JSON.stringify({ text })
          }
        );

        order.adminNote = result.adminNote || undefined;
        window.MC.toast(result.message, 'success');

        // little marker next to the order number in the list
        const mark = document.querySelector(`.note-mark[data-id="${order._id}"]`);
        if (mark) mark.hidden = !order.adminNote;
      } catch (error) {
        window.MC.toast(error.message || 'Note save nahi hua.', 'error');
      } finally {
        button.disabled = false;
      }
    });

  detailsRow
    .querySelector('.print-label')
    ?.addEventListener('click', () => {
      printShippingLabel(order);
    });

  const form =
    detailsRow.querySelector('.shipment-form');

  form
    ?.querySelector('.check-couriers')
    ?.addEventListener('click', () => {
      checkCourierRates(form, order);
    });

  form?.addEventListener('submit', event => {

    event.preventDefault();

    submitShipmentForm(form, order);
  });

  detailsRow
    .querySelector('.close-details')
    ?.addEventListener('click', () => {

      detailsRow.style.display = 'none';

    });
}


/* =====================================
   UPDATE ORDER STATUS
===================================== */

async function updateAdminOrderStatus(select) {

  const order = adminOrders.find(
    item => String(item._id) ===
      String(select.dataset.id)
  );

  if (!order) return;

  const newStatus = select.value;

  if (newStatus === order.orderStatus) {
    return;
  }

  if (
    newStatus === 'Cancelled' &&
    ['CASHFREE', 'RAZORPAY'].includes(
      order.paymentMethod
    )
  ) {

    notify(
      'Online payment orders require support-assisted cancellation.',
      'error'
    );

    select.value = order.orderStatus;
    return;
  }

  if (
    newStatus === 'Cancelled' &&
    !(await window.mcConfirm(
      'Cancel this order? Reserved stock may be returned.',
      { title: 'Order cancel karna hai?', okText: 'Haan, cancel karo', danger: true }
    ))
  ) {

    select.value = order.orderStatus;
    return;
  }

  select.disabled = true;

  try {

    await mcApi(
      '/admin/orders/' + order._id,
      {
        method: 'PUT',
        body: JSON.stringify({
          orderStatus: newStatus
        })
      }
    );

    notify('Order status updated.');

  } catch (err) {

    notify(
      err.message || 'Order update failed.',
      'error'
    );

  } finally {

    select.disabled = false;

    await loadAdminOrders();

  }
}


/* =====================================
   BIND BUTTONS
===================================== */

document.addEventListener('click', async event => {

  const button = event.target.closest('.refresh-payment');

  if (!button) return;

  button.disabled = true;

  try {
    const data = await window.MC.api(
      '/admin/orders/' + encodeURIComponent(button.dataset.id) + '/refresh-payment',
      { method: 'POST' }
    );

    const order = adminOrders.find(o => String(o._id) === button.dataset.id);

    if (order) order.paymentDetails = data.paymentDetails;

    notify('Payment details updated.');
    openOrderDetails(button.dataset.id);

  } catch (e) {
    button.disabled = false;
    notify(e.message || 'Could not fetch payment details.', 'error');
  }
});

function bindOrderButtons() {

  document.querySelectorAll('.view-order')
    .forEach(button => {

      button.addEventListener('click', () => {
        openOrderDetails(button.dataset.id);
      });

    });

  document.querySelectorAll('.order-status')
    .forEach(select => {

      select.addEventListener('change', () => {
        updateAdminOrderStatus(select);
      });

    });
}


/* =====================================
   LOAD ADMIN ORDERS
===================================== */

async function loadAdminOrders() {

  const admin =
    await window.requireAdmin();

  if (!admin) return;

  const ordersBox =
    document.querySelector('#orders');

  if (!ordersBox) return;

  const search =
    document.querySelector('#search')
      ?.value || '';

  try {

    const data = await mcApi(
      '/admin/orders?search=' +
      encodeURIComponent(search) +
      (window.mcOrderStatusFilter
        ? '&status=' + encodeURIComponent(window.mcOrderStatusFilter)
        : '')
    );

    adminOrders = Array.isArray(data.orders)
      ? data.orders
      : [];

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
      adminOrders.map(order => {

        const isOnline =
          order.paymentMethod === 'CASHFREE' ||
          order.paymentMethod === 'RAZORPAY';

        const statuses =
          isOnline
            ? ADMIN_ORDER_STATUSES.filter(
                status => status !== 'Cancelled'
              )
            : ADMIN_ORDER_STATUSES;

        if (!statuses.includes(order.orderStatus)) {
          statuses.push(order.orderStatus);
        }

        return `
          <tr>

            <td>

              <b>
                ${mcEscape(order.orderId)}
              </b>

              <br>

              <span class="mini">
                ${formatDate(order.createdAt)}
              </span>

              <span
                class="note-mark"
                data-id="${mcEscape(order._id)}"
                title="${mcEscape(order.adminNote?.text || '')}"
                ${order.adminNote?.text ? '' : 'hidden'}
              > 📝 note</span>

              <br><br>

              <button
                class="btn secondary view-order"
                type="button"
                data-id="${mcEscape(order._id)}">
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
                order.customer?.mobile ||
                ''
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

              ${order.refund && order.refund.status
                ? `<br><span class="mini" style="color:#b45309;font-weight:800">
                    ${order.refund.status === 'REFUNDED' ? 'REFUNDED' : 'REFUND PROCESSING'}
                    ${mcEscape(mcMoney(order.refund.amount))}
                  </span>`
                : ''}

            </td>

            <td>
              ${mcEscape(order.orderStatus)}
            </td>

            <td>

              <select
                class="select order-status"
                data-id="${mcEscape(order._id)}"
                ${order.orderStatus === 'Cancelled'
                  ? 'disabled'
                  : ''}
              >

                ${statuses.map(status => `
                  <option
                    value="${mcEscape(status)}"
                    ${status === order.orderStatus
                      ? 'selected'
                      : ''}
                  >
                    ${mcEscape(status)}
                  </option>
                `).join('')}

              </select>

            </td>

          </tr>

          <tr
            id="details-${mcEscape(order._id)}"
            style="display:none">
          </tr>
        `;

      }).join('');

    bindOrderButtons();

  } catch (err) {

    notify(
      err.message || 'Orders loading failed.',
      'error'
    );

    ordersBox.innerHTML = `
      <tr>
        <td colspan="6">
          Failed to load orders.
        </td>
      </tr>
    `;

  }
}


/* =====================================
   SEARCH
===================================== */

document.querySelector('#searchBtn')
  ?.addEventListener(
    'click',
    loadAdminOrders
  );

document.querySelector('#search')
  ?.addEventListener('keydown', event => {

    if (event.key === 'Enter') {
      event.preventDefault();
      loadAdminOrders();
    }

  });


/* =====================================
   START
===================================== */

loadAdminOrders();


/* =====================================
   STATUS FILTER (Sab / Ship karne hain / ...)
===================================== */

document.querySelector('#statusFilter')
  ?.addEventListener('click', event => {

    const button = event.target.closest('button[data-status]');

    if (!button) return;

    document.querySelectorAll('#statusFilter button')
      .forEach(b => b.classList.toggle('on', b === button));

    window.mcOrderStatusFilter = button.dataset.status;

    loadAdminOrders();

  });
