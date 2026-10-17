
/*
=========================================
 MEMORA CREATIONS
 CUSTOMER MY ORDERS

 COD + CASHFREE + RAZORPAY

 COD CANCEL ORDER
 CASHFREE CANCEL REQUEST
 ORDER TRACKING
 PRODUCT DETAILS
 PAYMENT STATUS
=========================================
*/

const ORDERS_BASE = '/memora-creations';

const orderUI = window.MC;

let orderActionRunning = false;

const CASHFREE_REQUEST_MARKER =
  'CUSTOMER_CASHFREE_CANCEL_REQUEST';


/* =====================================
   PAGE DESIGN
===================================== */

function installOrderActionStyles() {

  if (document.getElementById('mc-order-action-css')) {
    return;
  }

  const style = document.createElement('style');

  style.id = 'mc-order-action-css';

  style.textContent = `
    .mc-cancel-request-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px 19px;
      border: 1px solid #b77c4d;
      border-radius: 11px;
      background: #fff7ef;
      color: #8a4d28;
      font-weight: 800;
      font-size: 12px;
      cursor: pointer;
      text-align: center;
      transition: .2s;
    }

    .mc-cancel-request-btn:hover {
      background: #fbe9d7;
    }

    .mc-cancel-request-btn:disabled,
    .order-cancel-btn:disabled {
      opacity: .6;
      cursor: not-allowed;
    }

    .mc-request-sent {
      display: inline-flex;
      align-items: center;
      padding: 10px 14px;
      border-radius: 11px;
      border: 1px solid #bddcc9;
      background: #e9f7ee;
      color: #166534;
      font-size: 12px;
      font-weight: 800;
    }

    .mc-order-notice {
      margin: 10px 0;
      padding: 11px 14px;
      border: 1px solid #eee0d2;
      border-radius: 12px;
      background: #fffbf6;
      font-size: 12px;
      line-height: 1.65;
      color: #805b40;
    }

    .mc-order-notice.warning {
      background: #fff8e7;
      border-color: #f5ddad;
      color: #946100;
    }

    .mc-order-notice.success {
      background: #edf9f1;
      border-color: #c9e8d2;
      color: #166534;
    }

    .order-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 10px;
    }

    @media (max-width: 600px) {
      .order-actions > a,
      .order-actions > button,
      .order-actions > span {
        width: 100%;
        justify-content: center;
      }
    }
  `;

  document.head.appendChild(style);
}


/* =====================================
   FORMAT DATE
===================================== */

function formatOrderDate(value) {

  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}


/* =====================================
   ORDER STATUS CLASS
===================================== */

function orderStatusClass(status) {

  const value = String(
    status || ''
  ).toLowerCase();

  if (value === 'delivered') {
    return 'delivered';
  }

  if (value === 'cancelled') {
    return 'cancelled';
  }

  if (
    value === 'shipped' ||
    value === 'out for delivery'
  ) {
    return 'shipping';
  }

  return 'processing';
}


/* =====================================
   PAYMENT STATUS CLASS
===================================== */

function paymentStatusClass(status) {

  const value = String(
    status || ''
  ).toUpperCase();

  if (value === 'SUCCESS') {
    return 'paid';
  }

  if (
    value === 'FAILED' ||
    value === 'CANCELLED'
  ) {
    return 'failed';
  }

  return 'pending';
}


/* =====================================
   PAYMENT METHOD LABEL
===================================== */

function paymentMethodLabel(method) {

  switch (method) {

    case 'COD':
      return 'Cash on Delivery';

    case 'CASHFREE':
      return 'Cashfree Online Payment';

    case 'RAZORPAY':
      return 'Online Payment';

    default:
      return 'Online Payment';
  }
}


/* =====================================
   CHECK CANCELLATION ELIGIBILITY
===================================== */

function isEarlyOrderStatus(status) {

  return [
    'Order Placed',
    'Confirmed'
  ].includes(status);
}


function canCancelCOD(order) {

  return (
    order.paymentMethod === 'COD' &&
    order.paymentStatus === 'COD_PENDING' &&
    isEarlyOrderStatus(order.orderStatus)
  );
}


function hasCashfreeCancelRequest(order) {

  const history = Array.isArray(
    order.statusHistory
  )
    ? order.statusHistory
    : [];

  return history.some(item => {

    return String(
      item.note || ''
    ).startsWith(CASHFREE_REQUEST_MARKER);

  });
}


function canRequestCashfreeCancel(order) {

  return (
    order.paymentMethod === 'CASHFREE' &&
    order.paymentStatus === 'PENDING' &&
    isEarlyOrderStatus(order.orderStatus) &&
    !hasCashfreeCancelRequest(order)
  );
}


/* =====================================
   ORDER PRODUCTS HTML
===================================== */

function orderProductsHtml(order) {

  const items = Array.isArray(order.items)
    ? order.items
    : [];

  if (!items.length) {

    return `
      <div class="order-no-product">
        Product information available nahi hai.
      </div>
    `;
  }

  return items.map(item => {

    const image = item.imageUrl ||
      'https://placehold.co/180x180?text=Memora';

    const quantity = Math.max(
      1,
      Number(item.quantity) || 1
    );

    return `
      <div class="order-product">

        <div class="order-product-image">
          <img
            src="${orderUI.esc(image)}"
            alt="${orderUI.esc(item.name || 'Product')}"
            loading="lazy"
          >
        </div>

        <div class="order-product-info">

          <h3>
            ${orderUI.esc(item.name || 'Product')}
          </h3>

          <div class="order-product-meta">

            <span>
              Qty:
              <strong>${quantity}</strong>
            </span>

            <span>
              Price:
              <strong>
                ${orderUI.money(item.unitPrice)}
              </strong>
            </span>

          </div>
        </div>

        <div class="order-product-total">
          ${orderUI.money(item.lineTotal)}
        </div>

      </div>
    `;

  }).join('');
}


/* =====================================
   PAYMENT NOTICE
===================================== */

function orderPaymentNotice(order) {

  if (
    order.paymentMethod === 'CASHFREE' &&
    order.paymentStatus === 'PENDING'
  ) {

    return `
      <div class="mc-order-notice warning">

        Cashfree payment abhi confirm nahi
        hua hai. Payment verification ke
        bina order cancelled nahi mana
        jayega.

      </div>
    `;
  }

  if (
    order.paymentMethod === 'COD' &&
    order.paymentStatus === 'COD_PENDING' &&
    order.orderStatus === 'Delivered'
  ) {

    return `
      <div class="mc-order-notice">

        Delivery status: Delivered.
        COD payment receipt abhi
        confirm nahi hui hai.

      </div>
    `;
  }

  if (
    order.paymentMethod === 'CASHFREE' &&
    order.paymentStatus === 'SUCCESS'
  ) {

    return `
      <div class="mc-order-notice success">

        Online payment confirmed.

      </div>
    `;
  }

  return '';
}


/* =====================================
   ORDER ACTION BUTTONS
===================================== */

function orderActionsHtml(order) {

  const orderId = String(
    order._id || ''
  );

  const safeId = orderUI.esc(orderId);

  const trackButton = `
    <a
      class="order-track-btn"
      href="${ORDERS_BASE}/frontend/order-details.html?id=${encodeURIComponent(orderId)}"
    >
      View / Track Order →
    </a>
  `;

  let actionButton = '';

  if (canCancelCOD(order)) {

    actionButton = `
      <button
        class="order-cancel-btn cancel-order"
        type="button"
        data-id="${safeId}"
      >
        Cancel Order
      </button>
    `;

  } else if (canRequestCashfreeCancel(order)) {

    actionButton = `
      <button
        class="mc-cancel-request-btn cashfree-cancel-request"
        type="button"
        data-id="${safeId}"
      >
        Request Cancellation
      </button>
    `;

  } else if (
    order.paymentMethod === 'CASHFREE' &&
    hasCashfreeCancelRequest(order)
  ) {

    actionButton = `
      <span class="mc-request-sent">
        ✓ Cancellation Requested
      </span>
    `;
  }

  return `
    <div class="order-actions">
      ${trackButton}
      ${actionButton}
    </div>
  `;
}


/* =====================================
   ORDER CARD
===================================== */

function orderCardHtml(order) {

  const items = Array.isArray(order.items)
    ? order.items
    : [];

  const totalQuantity = items.reduce(
    (total, item) => total + Math.max(
      1,
      Number(item.quantity) || 1
    ),
    0
  );

  const paymentLabel = paymentMethodLabel(
    order.paymentMethod
  );

  const paymentStatus = String(
    order.paymentStatus || 'PENDING'
  ).toUpperCase();

  return `
    <article class="order-card">

      <div class="order-card-top">

        <div>

          <span class="order-label">
            ORDER ID
          </span>

          <h2>
            ${orderUI.esc(order.orderId || 'Order')}
          </h2>

          <p>
            ${orderUI.esc(
              formatOrderDate(order.createdAt)
            )}
          </p>

        </div>

        <div
          class="order-status ${orderStatusClass(order.orderStatus)}"
        >
          ${orderUI.esc(
            order.orderStatus || 'Order Placed'
          )}
        </div>

      </div>

      <div class="order-products">
        ${orderProductsHtml(order)}
      </div>

      <div class="order-info-grid">

        <div>
          <span>Items</span>
          <strong>${totalQuantity}</strong>
        </div>

        <div>
          <span>Payment</span>
          <strong>
            ${orderUI.esc(paymentLabel)}
          </strong>
        </div>

        <div>

          <span>Payment Status</span>

          <strong
            class="payment-state ${paymentStatusClass(paymentStatus)}"
          >
            ${orderUI.esc(paymentStatus)}
          </strong>

        </div>

        <div>

          <span>Order Total</span>

          <strong class="order-grand-total">
            ${orderUI.money(order.grandTotal)}
          </strong>

        </div>

      </div>

      ${orderPaymentNotice(order)}

      ${orderActionsHtml(order)}

    </article>
  `;
}


/* =====================================
   LOAD MY ORDERS
===================================== */

async function loadOrdersPage() {

  const ordersBox = orderUI.$('#orders');

  if (!ordersBox) return;

  try {

    const data = await orderUI.api('/orders');

    const orders = Array.isArray(data.orders)
      ? data.orders
      : [];

    const countBox = orderUI.$('#orderCount');

    if (countBox) {

      countBox.textContent =
        `${orders.length} ${
          orders.length === 1
            ? 'order'
            : 'orders'
        }`;
    }

    if (!orders.length) {

      ordersBox.innerHTML = `
        <div class="orders-empty">

          <div class="orders-empty-icon">
            🛍️
          </div>

          <h2>No Orders Yet</h2>

          <p>
            Aapne abhi tak koi order
            place nahi kiya hai.
          </p>

          <a
            href="${ORDERS_BASE}/frontend/products.html"
          >
            Start Shopping
          </a>

        </div>
      `;

      return;
    }

    ordersBox.innerHTML = orders
      .map(orderCardHtml)
      .join('');

    bindOrderActionButtons();

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
          Please thodi der baad
          dobara try karein.
        </p>

        <button
          type="button"
          id="retryOrdersLoad"
          class="order-track-btn"
        >
          Try Again
        </button>

      </div>
    `;

    orderUI.$('#retryOrdersLoad')
      ?.addEventListener(
        'click',
        loadOrdersPage
      );

    const countBox = orderUI.$('#orderCount');

    if (countBox) {
      countBox.textContent = 'Error';
    }

    orderUI.toast(
      error.message || 'Orders load failed.',
      'error'
    );
  }
}


/* =====================================
   CANCEL CONFIRMATION POPUP
===================================== */

function askOrderConfirmation({
  title,
  message,
  confirmText
}) {

  return new Promise(resolve => {

    document.querySelector(
      '#cancelOrderPopup'
    )?.remove();

    const overlay =
      document.createElement('div');

    overlay.id = 'cancelOrderPopup';

    overlay.className =
      'cancel-popup-overlay';

    /*
      Message strings below are
      controlled by our own code,
      never supplied by customer data.
    */

    overlay.innerHTML = `
      <div class="cancel-popup"
        role="dialog"
        aria-modal="true"
        aria-label="${title}">

        <div class="cancel-popup-icon">
          !
        </div>

        <h2>${title}</h2>

        <p>${message}</p>

        <div class="cancel-popup-actions">

          <button
            class="cancel-popup-back"
            type="button"
          >
            Go Back
          </button>

          <button
            class="cancel-popup-confirm"
            type="button"
          >
            ${confirmText}
          </button>

        </div>

      </div>
    `;

    document.body.appendChild(overlay);

    const previousFocus =
      document.activeElement;

    const cancelButton =
      overlay.querySelector(
        '.cancel-popup-back'
      );

    const confirmButton =
      overlay.querySelector(
        '.cancel-popup-confirm'
      );

    let finished = false;

    function finish(value) {

      if (finished) return;

      finished = true;

      document.removeEventListener(
        'keydown',
        keyHandler
      );

      overlay.remove();

      if (
        previousFocus &&
        previousFocus.isConnected &&
        typeof previousFocus.focus === 'function'
      ) {
        previousFocus.focus();
      }

      resolve(value);
    }

    function keyHandler(event) {

      if (event.key === 'Escape') {
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

    cancelButton.addEventListener(
      'click',
      () => finish(false)
    );

    confirmButton.addEventListener(
      'click',
      () => finish(true)
    );

    overlay.addEventListener(
      'click',
      event => {

        if (event.target === overlay) {
          finish(false);
        }
      }
    );

    document.addEventListener(
      'keydown',
      keyHandler
    );

    cancelButton.focus();

  });
}


/* =====================================
   CANCEL COD ORDER
===================================== */

async function cancelCustomerOrder(
  id,
  button = null
) {

  if (orderActionRunning) return;

  const confirmed = await askOrderConfirmation({
    title: 'Cancel COD Order?',
    message:
      'Kya aap sure hain ki is COD order ' +
      'ko cancel karna chahte hain?',
    confirmText: 'Yes, Cancel Order'
  });

  if (!confirmed || orderActionRunning) {
    return;
  }

  orderActionRunning = true;

  const oldText = button?.textContent;

  if (button) {
    button.disabled = true;
    button.textContent = 'Cancelling...';
  }

  try {

    await orderUI.api(
      '/orders/' +
      encodeURIComponent(id) +
      '/cancel',
      {
        method: 'PATCH'
      }
    );

    orderUI.toast(
      'COD Order cancelled successfully.',
      'success'
    );

    await loadOrdersPage();

  } catch (error) {

    orderUI.toast(
      error.message || 'Order cancel failed.',
      'error'
    );

    if (button) {
      button.disabled = false;
      button.textContent =
        oldText || 'Cancel Order';
    }

  } finally {

    orderActionRunning = false;

  }
}


/* =====================================
   CASHFREE CANCELLATION REQUEST

   This is NOT an immediate
   payment or order cancellation.
===================================== */

async function requestCashfreeCancellation(
  id,
  button = null
) {

  if (orderActionRunning) return;

  const confirmed = await askOrderConfirmation({
    title: 'Request Cancellation?',
    message:
      'Cashfree order ke liye cancellation ' +
      'request bheji jayegi. Payment aur ' +
      'stock verify hone ke baad hi ' +
      'cancellation process hogi. ' +
      'Order turant cancel nahi hoga.',
    confirmText: 'Submit Request'
  });

  if (!confirmed || orderActionRunning) {
    return;
  }

  orderActionRunning = true;

  const oldText = button?.textContent;

  if (button) {
    button.disabled = true;
    button.textContent = 'Submitting...';
  }

  try {

    const result = await orderUI.api(
      '/orders/' +
      encodeURIComponent(id) +
      '/cancel-request',
      {
        method: 'POST'
      }
    );

    if (
      result.requestStatus !== 'REQUESTED' &&
      result.requestStatus !== 'ALREADY_REQUESTED'
    ) {
      throw new Error(
        'Cancellation request could not be verified.'
      );
    }

    orderUI.toast(
      'Cancellation request submitted. ' +
      'Order is not cancelled yet.',
      'success'
    );

    await loadOrdersPage();

  } catch (error) {

    orderUI.toast(
      error.message ||
      'Cancellation request failed.',
      'error'
    );

    if (button) {
      button.disabled = false;
      button.textContent =
        oldText || 'Request Cancellation';
    }

  } finally {

    orderActionRunning = false;

  }
}


/* =====================================
   BIND ORDER ACTION BUTTONS
===================================== */

function bindOrderActionButtons() {

  orderUI.$$('.cancel-order').forEach(
    button => {

      button.addEventListener(
        'click',
        async () => {

          await cancelCustomerOrder(
            button.dataset.id,
            button
          );

        }
      );

    }
  );

  orderUI.$$('.cashfree-cancel-request').forEach(
    button => {

      button.addEventListener(
        'click',
        async () => {

          await requestCashfreeCancellation(
            button.dataset.id,
            button
          );

        }
      );

    }
  );
}


/* =====================================
   START
===================================== */

if (orderUI?.$('#orders')) {

  installOrderActionStyles();

  loadOrdersPage();

}
