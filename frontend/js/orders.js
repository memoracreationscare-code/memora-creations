
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

 NEW:
 VERIFIED DELIVERED PRODUCT REVIEWS
 1-5 STAR RATING
 REVIEW PHOTOS
 ADMIN APPROVAL

 REVIEW CONDITION:
 orderStatus === 'Delivered'
 paymentStatus === 'SUCCESS'
=========================================
*/

const ORDERS_BASE = '';

const ORDERS_API =
  'https://api.memoracreationscare.in/api';

const orderUI = window.MC;

let orderActionRunning = false;

let orderReviewRunning = false;

const CASHFREE_REQUEST_MARKER =
  'CUSTOMER_CASHFREE_CANCEL_REQUEST';

const REVIEW_MAX_PHOTOS = 3;

const REVIEW_MAX_FILE_SIZE =
  5 * 1024 * 1024;


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

    /* =============================
       VERIFIED PRODUCT REVIEWS
    ============================= */

    .mc-order-review-area {
      margin-top: 14px;
      padding: 14px;
      background: #faf6f2;
      border: 1px solid #eadccd;
      border-radius: 14px;
    }

    .mc-review-verified {
      display: block;
      color: #237448;
      font-size: 12px;
      font-weight: 800;
      margin-bottom: 10px;
    }

    .mc-write-review {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 11px 18px;
      background: #8b5b3a;
      color: white;
      border: 0;
      border-radius: 11px;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
    }

    .mc-write-review:disabled {
      opacity: .6;
      cursor: not-allowed;
    }

    .mc-review-form {
      padding: 18px;
      margin-top: 14px;
      border: 1px solid #e9dbce;
      border-radius: 14px;
      background: white;
    }

    .mc-review-form h4 {
      margin: 0 0 13px;
      font-size: 17px;
      color: #302117;
    }

    .mc-review-form label {
      display: block;
      font-weight: 800;
      font-size: 13px;
      margin: 13px 0 7px;
      color: #49382e;
    }

    .mc-review-form input[type="text"],
    .mc-review-form textarea {
      display: block;
      width: 100%;
      padding: 12px;
      border: 1px solid #dacfc4;
      border-radius: 11px;
      background: white;
      color: #302117;
      font: inherit;
    }

    .mc-review-form textarea {
      min-height: 110px;
      resize: vertical;
    }

    .mc-review-form input[type="file"] {
      max-width: 100%;
      font-size: 12px;
    }

    .mc-review-stars {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .mc-review-star {
      border: 0;
      background: transparent;
      padding: 3px;
      font-size: 34px;
      color: #cfc5b9;
      cursor: pointer;
    }

    .mc-review-star.selected {
      color: #e2a32b;
    }

    .mc-review-form-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 18px;
    }

    .mc-review-submit {
      padding: 12px 20px;
      border: 0;
      border-radius: 11px;
      background: #237448;
      color: white;
      font-weight: 800;
      cursor: pointer;
    }

    .mc-review-cancel {
      padding: 12px 20px;
      border: 1px solid #e0d3c8;
      border-radius: 11px;
      background: #f5efea;
      color: #302117;
      font-weight: 800;
      cursor: pointer;
    }

    .mc-review-submit:disabled,
    .mc-review-cancel:disabled {
      opacity: .6;
      cursor: not-allowed;
    }

    .mc-review-message {
      display: block;
      margin-top: 10px;
      font-size: 12px;
      color: #805b40;
      line-height: 1.5;
    }

    .mc-review-complete {
      display: inline-block;
      padding: 10px 13px;
      color: #166534;
      background: #e9f7ee;
      border: 1px solid #bddcc9;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 800;
    }

    @media (max-width: 600px) {

      .order-actions > a,
      .order-actions > button,
      .order-actions > span {
        width: 100%;
        justify-content: center;
      }

      .mc-review-form {
        padding: 13px;
      }

      .mc-review-form-actions > button {
        flex: 1;
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
    ['PENDING', 'SUCCESS'].includes(order.paymentStatus) &&
    isEarlyOrderStatus(order.orderStatus) &&
    !hasCashfreeCancelRequest(order)
  );
}



/* =====================================
   RETURN / REPLACEMENT REQUEST
===================================== */

const RETURN_STATUS_TEXT = {
  REQUESTED: 'Return request sent - under review',
  APPROVED: 'Return request approved - we will contact you',
  REJECTED: 'Return request was not approved',
  COMPLETED: 'Return request completed'
};

function returnRequestHtml(order, safeId) {

  const request = order.returnRequest;

  if (request && request.status) {

    const text = RETURN_STATUS_TEXT[request.status] || 'Return request sent';

    return `
      <span class="mc-request-sent">
        ${orderUI.esc(text)}
      </span>
      ${request.adminNote
        ? `<span class="mc-request-sent">${orderUI.esc(request.adminNote)}</span>`
        : ''}
    `;
  }

  if (order.orderStatus === 'Delivered' && order.returnEligible) {

    return `
      <button
        class="mc-cancel-request-btn return-request-btn"
        type="button"
        data-id="${safeId}"
      >
        Return / Replacement
      </button>
    `;
  }

  return '';
}

function openReturnDialog(orderId, button) {

  const old = document.getElementById('mcReturnDialog');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'mcReturnDialog';
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.45);' +
    'display:flex;align-items:center;justify-content:center;padding:16px;';

  overlay.innerHTML = `
    <form style="background:#fff;border-radius:16px;max-width:420px;width:100%;
      padding:22px;display:grid;gap:12px;max-height:90vh;overflow:auto;
      font-family:inherit;color:#3b2a1d">
      <h3 style="margin:0">Return / Replacement request</h3>
      <label>I want
        <select name="type" style="width:100%;padding:10px;margin-top:4px">
          <option value="RETURN">Return (refund)</option>
          <option value="REPLACEMENT">Replacement</option>
        </select>
      </label>
      <label>Reason
        <select name="reason" style="width:100%;padding:10px;margin-top:4px">
          <option>Product damaged</option>
          <option>Wrong product received</option>
          <option>Product defective</option>
          <option>Item missing</option>
          <option>Not as shown in photos</option>
          <option>Other</option>
        </select>
      </label>
      <label>Tell us what happened
        <textarea name="details" rows="4" maxlength="1000" required
          style="width:100%;padding:10px;margin-top:4px"
          placeholder="Please describe the problem"></textarea>
      </label>
      <small>Please also send clear photos of the product and parcel on
        WhatsApp 88740 50204 with your Order ID.</small>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button type="button" data-close class="btn secondary">Close</button>
        <button type="submit" class="btn">Send request</button>
      </div>
    </form>`;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();

  overlay.addEventListener('click', e => {
    if (e.target === overlay || e.target.closest('[data-close]')) close();
  });

  overlay.querySelector('form').addEventListener('submit', async e => {
    e.preventDefault();

    const form = e.currentTarget;
    const submit = form.querySelector('[type=submit]');

    submit.disabled = true;

    try {
      await orderUI.api(
        '/orders/' + encodeURIComponent(orderId) + '/return-request',
        {
          method: 'POST',
          body: JSON.stringify({
            type: form.type.value,
            reason: form.reason.value,
            details: form.details.value
          })
        }
      );

      close();
      orderUI.toast('Return request sent. We will contact you soon.', 'success');

      if (button) {
        button.outerHTML =
          '<span class="mc-request-sent">Return request sent - under review</span>';
      }

    } catch (error) {
      submit.disabled = false;
      orderUI.toast(error.message || 'Could not send request.', 'error');
    }
  });
}


/* =====================================
   REVIEW ELIGIBILITY

   STRICT:
   SUCCESSFULLY DELIVERED
   AND PAYMENT SUCCESS

   NEVER SHOW ON:
   PENDING
   CONFIRMED
   PACKED
   SHIPPED
   OUT FOR DELIVERY
   CANCELLED
   UNPAID
===================================== */

function canReviewDeliveredOrder(order) {

  return (
    order.orderStatus === 'Delivered' &&
    order.paymentStatus === 'SUCCESS' &&
    [
      'COD',
      'CASHFREE',
      'RAZORPAY'
    ].includes(order.paymentMethod)
  );
}


/* =====================================
   VALID PRODUCT ID
===================================== */

function getReviewProductId(item) {

  const product = item?.product;

  const id =
    typeof product === 'string'
      ? product
      : product?._id || '';

  const result = String(id);

  return /^[a-fA-F0-9]{24}$/.test(result)
    ? result
    : '';
}


/* =====================================
   REVIEW BUTTON PER DELIVERED PRODUCT
===================================== */

function deliveredReviewHtml(order, item) {

  if (!canReviewDeliveredOrder(order)) {
    return '';
  }

  const productId = getReviewProductId(item);

  if (!productId) {
    return '';
  }

  return `
    <div class="mc-order-review-area"
      data-review-product="${orderUI.esc(productId)}">

      <span class="mc-review-verified">
        ✓ Successfully Delivered · Payment Confirmed
      </span>

      <button
        type="button"
        class="mc-write-review"
        data-product-id="${orderUI.esc(productId)}"
      >
        ⭐ Write Review
      </button>

      <div class="mc-review-form-holder"></div>

    </div>
  `;
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

          ${deliveredReviewHtml(order, item)}

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

  if (order.refund && order.refund.status) {

    const done = order.refund.status === 'REFUNDED';

    return `
      <div class="mc-order-notice success">

        ${done
          ? 'Refund of ' + orderUI.money(order.refund.amount) +
            ' completed. It reaches your bank/UPI account in 5-7 working days.'
          : 'Refund of ' + orderUI.money(order.refund.amount) +
            ' is being processed (5-7 working days).'}

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
        ${order.paymentStatus === 'SUCCESS' ? 'Cancel Order' : 'Cancel Order'}
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
      ${returnRequestHtml(order, safeId)}
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
    bindDeliveredReviewButtons();

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
    title: 'Cancel this order?',
    message:
      'Order cancel ho jayega. Agar aapne online payment kiya hai ' +
      'to paisa wapas aapke account me bheja jayega ' +
      '(5-7 working days).',
    confirmText: 'Yes, Cancel Order'
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
      result.requestStatus !== 'CANCELLED' &&
      result.requestStatus !== 'REQUESTED' &&
      result.requestStatus !== 'ALREADY_REQUESTED'
    ) {
      throw new Error(
        'Cancellation request could not be verified.'
      );
    }

    orderUI.toast(
      result.requestStatus === 'CANCELLED'
        ? (result.message || 'Order cancelled.')
        : 'Request submitted for admin review. ' +
          'Order is not cancelled and no refund is initiated.',
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
   BIND ORIGINAL ORDER ACTION BUTTONS
===================================== */

function bindOrderActionButtons() {

  orderUI.$$('.return-request-btn').forEach(button => {
    button.addEventListener('click', () => {
      openReturnDialog(button.dataset.id, button);
    });
  });

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
   DELIVERED REVIEW HELPERS
===================================== */

function reviewMessage(holder, message) {

  holder.replaceChildren();

  const box = document.createElement('div');

  box.className = 'mc-review-message';

  box.textContent = message;

  holder.appendChild(box);
}


function markProductReviewed(productId) {

  document.querySelectorAll(
    '.mc-write-review'
  ).forEach(button => {

    if (button.dataset.productId !== productId) {
      return;
    }

    button.textContent = '✓ Review Submitted';
    button.disabled = true;

    const area = button.closest(
      '.mc-order-review-area'
    );

    const holder = area?.querySelector(
      '.mc-review-form-holder'
    );

    if (holder) {
      reviewMessage(
        holder,
        'Review submitted for admin approval.'
      );
    }

  });
}


/* =====================================
   REVIEW STAR FORM

   APPEARS ONLY AFTER BACKEND
   ELIGIBILITY CONFIRMATION
===================================== */

function showDeliveredReviewForm(
  button,
  productId
) {

  const area = button.closest(
    '.mc-order-review-area'
  );

  const holder = area?.querySelector(
    '.mc-review-form-holder'
  );

  if (!holder) return;

  if (holder.querySelector('form')) {
    holder.replaceChildren();
    return;
  }

  holder.innerHTML = `
    <form class="mc-review-form">

      <h4>
        Rate Your Delivered Product
      </h4>

      <label>
        Star Rating *
      </label>

      <div
        class="mc-review-stars"
        role="group"
        aria-label="Choose product rating"
      >

        ${[1, 2, 3, 4, 5].map(number => `

          <button
            type="button"
            class="mc-review-star"
            data-rating="${number}"
            aria-label="${number} stars"
            aria-pressed="false"
          >
            ★
          </button>

        `).join('')}

      </div>

      <input
        type="hidden"
        name="rating"
        value="0"
      >

      <label>
        Review Title
      </label>

      <input
        type="text"
        name="title"
        maxlength="120"
        placeholder="Great product"
      >

      <label>
        Your Review *
      </label>

      <textarea
        name="comment"
        minlength="10"
        maxlength="1500"
        placeholder="Product kaisa laga? Apna experience likhein..."
        required
      ></textarea>

      <label>
        Product Photos (Optional)
      </label>

      <input
        type="file"
        name="photos"
        accept="image/jpeg,image/png,image/webp"
        multiple
      >

      <p class="mc-review-message">
        Maximum 3 photos, each up to 5 MB.
      </p>

      <div class="mc-review-form-actions">

        <button
          type="submit"
          class="mc-review-submit"
        >
          Submit Review
        </button>

        <button
          type="button"
          class="mc-review-cancel"
        >
          Close
        </button>

      </div>

      <p
        class="mc-review-message mc-review-progress"
        role="status"
        aria-live="polite"
      ></p>

    </form>
  `;

  const form = holder.querySelector('form');

  const ratingInput = form.querySelector(
    '[name="rating"]'
  );

  const stars = form.querySelectorAll(
    '.mc-review-star'
  );

  stars.forEach(star => {

    star.addEventListener('click', () => {

      const selected = Number(
        star.dataset.rating
      );

      ratingInput.value = String(selected);

      stars.forEach(item => {

        const number = Number(
          item.dataset.rating
        );

        item.classList.toggle(
          'selected',
          number <= selected
        );

        item.setAttribute(
          'aria-pressed',
          String(number === selected)
        );

      });

    });

  });

  form.querySelector(
    '.mc-review-cancel'
  ).addEventListener('click', () => {

    if (orderReviewRunning) return;

    holder.replaceChildren();

  });

  form.addEventListener('submit', async event => {

    event.preventDefault();

    await submitDeliveredReview(
      form,
      productId
    );

  });
}


/* =====================================
   UPLOAD REVIEW PHOTO
===================================== */

async function uploadDeliveredReviewPhoto(
  productId,
  file
) {

  const form = new FormData();

  form.append('photo', file);

  const response = await fetch(
    ORDERS_API +
    '/reviews/product/' +
    encodeURIComponent(productId) +
    '/photo',
    {
      method: 'POST',
      credentials: 'include',
      body: form
    }
  );

  const result = await response.json()
    .catch(() => ({}));

  if (!response.ok || !result.url) {

    throw new Error(
      result.message ||
      'Photo upload failed.'
    );

  }

  return result.url;
}


/* =====================================
   SUBMIT DELIVERED PRODUCT REVIEW

   SERVER RECHECKS VERIFIED PURCHASE
===================================== */

async function submitDeliveredReview(
  form,
  productId
) {

  if (orderReviewRunning) {
    return;
  }

  const rating = Number(
    form.querySelector('[name="rating"]').value
  );

  const title = form.querySelector(
    '[name="title"]'
  ).value.trim();

  const comment = form.querySelector(
    '[name="comment"]'
  ).value.trim();

  const files = Array.from(
    form.querySelector('[name="photos"]').files || []
  );

  if (
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {

    orderUI.toast(
      'Please select 1 to 5 stars.',
      'error'
    );

    return;
  }

  if (
    comment.length < 10 ||
    comment.length > 1500
  ) {

    orderUI.toast(
      'Review must contain 10 to 1500 characters.',
      'error'
    );

    return;
  }

  if (files.length > REVIEW_MAX_PHOTOS) {

    orderUI.toast(
      'Maximum 3 photos allowed.',
      'error'
    );

    return;
  }

  for (const file of files) {

    if (
      ![
        'image/jpeg',
        'image/png',
        'image/webp'
      ].includes(file.type) ||
      file.size > REVIEW_MAX_FILE_SIZE
    ) {

      orderUI.toast(
        'Only JPG, PNG and WebP under 5 MB allowed.',
        'error'
      );

      return;
    }

  }

  orderReviewRunning = true;

  const submitButton = form.querySelector(
    '.mc-review-submit'
  );

  const closeButton = form.querySelector(
    '.mc-review-cancel'
  );

  const progress = form.querySelector(
    '.mc-review-progress'
  );

  submitButton.disabled = true;
  closeButton.disabled = true;

  try {

    /*
      Recheck eligibility before uploading.
    */

    const eligibility = await orderUI.api(
      '/reviews/product/' +
      encodeURIComponent(productId) +
      '/eligibility'
    );

    if (!eligibility.eligible) {

      throw new Error(
        eligibility.message ||
        'Review not allowed for this product.'
      );

    }

    const photos = [];

    for (
      let index = 0;
      index < files.length;
      index++
    ) {

      progress.textContent =
        'Uploading photo ' +
        (index + 1) +
        ' of ' +
        files.length +
        '...';

      const photo = await uploadDeliveredReviewPhoto(
        productId,
        files[index]
      );

      photos.push(photo);
    }

    progress.textContent =
      'Submitting your review...';

    await orderUI.api(
      '/reviews/product/' +
      encodeURIComponent(productId),
      {
        method: 'POST',
        body: JSON.stringify({
          rating,
          title,
          comment,
          photos
        })
      }
    );

    markProductReviewed(productId);

    orderUI.toast(
      'Review submitted for admin approval.',
      'success'
    );

  } catch (error) {

    progress.textContent =
      error.message ||
      'Review submission failed.';

    orderUI.toast(
      progress.textContent,
      'error'
    );

  } finally {

    orderReviewRunning = false;

    if (submitButton.isConnected) {
      submitButton.disabled = false;
    }

    if (closeButton.isConnected) {
      closeButton.disabled = false;
    }

  }
}


/* =====================================
   REVIEW BUTTON

   SHOWS ONLY WHEN:
   DELIVERED + SUCCESS

   SERVER VALIDATES PURCHASE AGAIN
===================================== */

function bindDeliveredReviewButtons() {

  const buttons = document.querySelectorAll(
    '.mc-write-review'
  );

  buttons.forEach(button => {

    button.addEventListener('click', async () => {

      if (
        button.disabled ||
        orderReviewRunning
      ) {
        return;
      }

      const productId =
        button.dataset.productId;

      if (!productId) return;

      const area = button.closest(
        '.mc-order-review-area'
      );

      const holder = area?.querySelector(
        '.mc-review-form-holder'
      );

      if (!holder) return;

      /*
        Close currently open form.
      */

      if (holder.querySelector('form')) {
        holder.replaceChildren();
        return;
      }

      button.disabled = true;

      const previousText = button.textContent;

      button.textContent =
        'Checking Purchase...';

      try {

        const data = await orderUI.api(
          '/reviews/product/' +
          encodeURIComponent(productId) +
          '/eligibility'
        );

        if (data.alreadyReviewed) {

          markProductReviewed(productId);

          return;
        }

        if (!data.eligible) {

          reviewMessage(
            holder,
            data.message ||
            'Review not available.'
          );

          return;
        }

        showDeliveredReviewForm(
          button,
          productId
        );

      } catch (error) {

        reviewMessage(
          holder,
          error.message ||
          'Could not verify this purchase.'
        );

      } finally {

        if (button.isConnected && !button.textContent.includes('Review Submitted')) {
          button.disabled = false;
          button.textContent = previousText;
        }

      }

    });

  });
}


/* =====================================
   START
===================================== */

if (orderUI?.$('#orders')) {

  installOrderActionStyles();

  loadOrdersPage();

}
