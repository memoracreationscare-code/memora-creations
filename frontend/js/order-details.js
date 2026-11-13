
/*
=========================================
 MEMORA CREATIONS
 ORDER DETAILS

 Order Tracking
 COD / Online Payment
 Legacy Razorpay Retry
 Gift Wrapping Details
 Personal Gift Message
=========================================
*/

'use strict';

const ORDER_BASE = '';

let currentOrderDetails = null;
let retryPaymentRunning = false;


/* =====================================
   HELPERS
===================================== */

function orderEsc(value) {
  return window.MC.esc(
    String(value ?? '')
  );
}

function orderMoney(value) {
  return window.MC.money(
    Number(value) || 0
  );
}

function formatOrderDetailsDate(value) {
  if (!value) return '';

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleString(
      'en-IN',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }
    );
  } catch (_) {
    return '';
  }
}

function detailsStatusClass(status) {
  const value = String(
    status || ''
  ).toLowerCase();

  if (value === 'cancelled') {
    return 'cancelled';
  }

  if (value === 'delivered') {
    return 'delivered';
  }

  if (
    value === 'shipped' ||
    value === 'out for delivery'
  ) {
    return 'shipping';
  }

  return 'processing';
}

function getOrderStatusTitle(order) {
  switch (order.orderStatus) {
    case 'Cancelled':
      return 'Order Cancelled';

    case 'Delivered':
      return 'Order Delivered';

    case 'Out for Delivery':
      return 'Out for Delivery';

    case 'Shipped':
      return 'Order Shipped';

    case 'Packed':
      return 'Order Packed';

    default:
      return 'Order Confirmed';
  }
}


/* =====================================
   PAYMENT SUCCESS POPUP
===================================== */

function showOrderPaymentSuccess(orderId) {
  document.querySelector(
    '#orderPaymentSuccess'
  )?.remove();

  const overlay =
    document.createElement('div');

  overlay.id = 'orderPaymentSuccess';
  overlay.className = 'order-success-popup';

  overlay.innerHTML = `
    <div class="order-success-popup-box">
      <div class="order-success-popup-icon">
        ✓
      </div>

      <h2>Payment Successful</h2>

      <p>
        Your payment has been completed
        and the order is confirmed.
      </p>

      <button
        type="button"
        id="paymentSuccessContinue"
      >
        Continue
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector(
    '#paymentSuccessContinue'
  )?.addEventListener(
    'click',
    () => {
      location.href =
        ORDER_BASE +
        '/frontend/order-details.html?id=' +
        encodeURIComponent(orderId);
    }
  );
}


/* =====================================
   RAZORPAY SDK
   LEGACY SUPPORT PRESERVED
===================================== */

function loadOrderRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }

    const existingScript =
      document.querySelector(
        'script[data-order-razorpay="true"]'
      );

    if (existingScript) {
      existingScript.addEventListener(
        'load',
        resolve,
        { once: true }
      );

      existingScript.addEventListener(
        'error',
        () => reject(
          new Error(
            'Razorpay Checkout load nahi hua.'
          )
        ),
        { once: true }
      );

      return;
    }

    const script =
      document.createElement('script');

    script.src =
      'https://checkout.razorpay.com/v1/checkout.js';

    script.dataset.orderRazorpay = 'true';

    script.onload = resolve;

    script.onerror = () => reject(
      new Error(
        'Razorpay Checkout load nahi hua.'
      )
    );

    document.head.appendChild(script);
  });
}


/* =====================================
   ORDER PRODUCTS
===================================== */

function orderDetailProducts(items) {
  if (!items.length) {
    return `
      <div class="empty">
        No order items found.
      </div>
    `;
  }

  return items.map(item => `
    <div class="order-detail-product">

      <div class="order-detail-product-image">
        <img
          src="${orderEsc(
            item.imageUrl ||
            'https://placehold.co/180x180?text=Memora'
          )}"
          alt="${orderEsc(
            item.name || 'Product'
          )}"
        >
      </div>

      <div class="order-detail-product-info">
        <h3>
          ${orderEsc(item.name || 'Product')}
        </h3>

        <span>
          Quantity:
          ${Number(item.quantity) || 1}
        </span>

        <span>
          Unit Price:
          ${orderMoney(item.unitPrice)}
        </span>
      </div>

      <div class="order-detail-product-total">
        ${orderMoney(item.lineTotal)}
      </div>

    </div>
  `).join('');
}


/* =====================================
   ORDER TRACKING
===================================== */

function orderTrackingHtml(history) {
  if (!history.length) {
    return `
      <div class="empty">
        Tracking update not available yet.
      </div>
    `;
  }

  return `
    <div class="tracking-list">
      ${history.map(status => `
        <div class="tracking-item">
          <span class="tracking-dot"></span>

          <strong>
            ${orderEsc(status.status || '')}
          </strong>

          <div class="tracking-date">
            ${orderEsc(
              formatOrderDetailsDate(
                status.changedAt
              )
            )}
          </div>

          ${
            status.note
              ? `
                <div class="tracking-note">
                  ${orderEsc(status.note)}
                </div>
              `
              : ''
          }
        </div>
      `).join('')}
    </div>
  `;
}


/* =====================================
   GIFT WRAPPING DISPLAY

   Uses data saved on the order.
   Never calculates or adds a fee
   on the frontend.
===================================== */

function giftWrappingDisplay(order) {
  const gift = order.giftWrapping;

  if (
    !gift ||
    gift.selected !== true
  ) {
    return {
      selected: false,
      type: 'NONE',
      label: '',
      fee: 0,
      message: ''
    };
  }

  const type = String(
    gift.type || ''
  ).toUpperCase();

  const label =
    type === 'PREMIUM'
      ? 'Premium Gift Wrapping'
      : type === 'STANDARD'
        ? 'Standard Gift Wrapping'
        : 'Gift Wrapping';

  const fee = Number(gift.fee);

  return {
    selected: true,
    type,
    label,
    fee:
      Number.isFinite(fee) && fee >= 0
        ? fee
        : 0,
    message:
      typeof gift.message === 'string'
        ? gift.message
        : ''
  };
}

function giftSummaryHtml(order) {
  const gift =
    giftWrappingDisplay(order);

  if (!gift.selected) {
    return '';
  }

  return `
    <div class="order-summary-line">
      <span>
        🎁 ${orderEsc(gift.label)}
      </span>

      <strong>
        ${orderMoney(gift.fee)}
      </strong>
    </div>
  `;
}

function giftMessageHtml(order) {
  const gift =
    giftWrappingDisplay(order);

  if (!gift.selected) {
    return '';
  }

  return `
    <section
      class="order-details-card"
      style="margin-top:20px"
    >

      <div class="order-section-title">
        <span>YOUR GIFT</span>
        <h2>Gift Wrapping</h2>
      </div>

      <div
        style="
          padding:17px;
          background:#fff8f0;
          border:1px solid #ecd8c5;
          border-radius:14px;
        "
      >
        <strong
          style="
            display:block;
            color:#663f28;
            margin-bottom:8px;
          "
        >
          🎁 ${orderEsc(gift.label)}
        </strong>

        <p
          style="
            margin:0;
            color:#765943;
            line-height:1.6;
          "
        >
          Wrapping Charge:
          <strong>
            ${orderMoney(gift.fee)}
          </strong>
        </p>

        ${
          gift.message.trim()
            ? `
              <div
                style="
                  margin-top:15px;
                  padding:14px;
                  background:white;
                  border-radius:10px;
                  border:1px solid #ebd9c8;
                "
              >
                <strong
                  style="
                    color:#663f28;
                    display:block;
                    margin-bottom:8px;
                  "
                >
                  Personal Gift Message
                </strong>

                <p
                  style="
                    margin:0;
                    white-space:pre-wrap;
                    overflow-wrap:anywhere;
                    line-height:1.7;
                    color:#564034;
                  "
                >${orderEsc(gift.message)}</p>
              </div>
            `
            : `
              <p
                style="
                  font-size:12px;
                  color:#866b55;
                  margin:12px 0 0;
                "
              >
                No personal message added.
              </p>
            `
        }
      </div>

    </section>
  `;
}


/* =====================================
   COUPON SUMMARY
===================================== */

function couponSummaryHtml(order) {
  const discount =
    Number(order.couponDiscount || 0);

  if (!Number.isFinite(discount) ||
      discount <= 0) {
    return '';
  }

  return `
    <div class="order-summary-line">
      <span>
        Coupon Discount
        ${
          order.couponCode
            ? `(${orderEsc(order.couponCode)})`
            : ''
        }
      </span>

      <strong>
        -${orderMoney(discount)}
      </strong>
    </div>
  `;
}


/* =====================================
   LOAD ORDER DETAILS
===================================== */

async function loadOrderDetails() {
  const orderBox =
    window.MC.$('#order');

  if (!orderBox) {
    return;
  }

  const id =
    new URLSearchParams(
      location.search
    ).get('id');

  if (!id) {
    orderBox.innerHTML = `
      <div class="empty">
        Order ID is missing.
      </div>
    `;
    return;
  }

  const data =
    await window.MC.api(
      '/orders/' +
      encodeURIComponent(id)
    );

  currentOrderDetails =
    data.order || null;

  if (!currentOrderDetails) {
    orderBox.innerHTML = `
      <div class="empty">
        Order not found.
      </div>
    `;
    return;
  }

  const order =
    currentOrderDetails;

  const items =
    Array.isArray(order.items)
      ? order.items
      : [];

  const history =
    Array.isArray(order.statusHistory)
      ? order.statusHistory
      : [];

  const statusTitle =
    getOrderStatusTitle(order);

  orderBox.innerHTML = `

    <section class="order-status-hero">
      <div>
        <div class="order-status-eyebrow">
          ORDER STATUS
        </div>

        <h1>
          ${orderEsc(statusTitle)}
        </h1>

        <p>
          Order ID:

          <strong>
            ${orderEsc(order.orderId || '')}
          </strong>

          •

          ${orderEsc(
            formatOrderDetailsDate(
              order.createdAt
            )
          )}
        </p>
      </div>

      <div class="order-status-badge ${detailsStatusClass(
        order.orderStatus
      )}">
        ${orderEsc(order.orderStatus || '')}
      </div>
    </section>


    <div class="order-details-grid">

      <!-- LEFT COLUMN -->

      <div>

        <section class="order-details-card">

          <div class="order-section-title">
            <span>YOUR ITEMS</span>
            <h2>Products</h2>
          </div>

          ${orderDetailProducts(items)}

        </section>


        <!-- GIFT WRAPPING DETAILS -->

        ${giftMessageHtml(order)}


        <section
          class="order-details-card tracking-section"
        >

          <div class="order-section-title">
            <span>TRACK YOUR ORDER</span>
            <h2>Order Tracking</h2>
          </div>

          ${orderTrackingHtml(history)}

        </section>

      </div>


      <!-- RIGHT COLUMN -->

      <aside class="order-summary-card">

        <div class="order-section-title">
          <span>ORDER</span>
          <h2>Summary</h2>
        </div>


        <div class="order-summary-line">
          <span>Payment</span>

          <strong>
            ${
              order.codAdvance?.enabled
                ? 'Cash on Delivery (advance paid online)'
                : order.paymentMethod === 'COD'
                ? 'Cash on Delivery'
                : 'Online Payment'
            }
          </strong>
        </div>


        <div class="order-summary-line">
          <span>Payment Status</span>

          <strong>
            ${orderEsc(
              order.paymentStatus || ''
            )}
          </strong>
        </div>


        <div class="order-summary-line">
          <span>Order Status</span>

          <strong>
            ${orderEsc(
              order.orderStatus || ''
            )}
          </strong>
        </div>


        <div class="order-summary-line">
          <span>Subtotal</span>

          <strong>
            ${orderMoney(
              order.subtotal
            )}
          </strong>
        </div>


        <div class="order-summary-line">
          <span>Delivery</span>

          <strong>
            ${orderMoney(
              order.deliveryCharge
            )}
          </strong>
        </div>


        <div class="order-summary-line">
          <span>You Save</span>

          <strong>
            ${orderMoney(
              order.discount
            )}
          </strong>
        </div>


        <!-- SAVED COUPON DISCOUNT -->

        ${couponSummaryHtml(order)}


        <!-- SAVED GIFT WRAPPING FEE -->

        ${giftSummaryHtml(order)}


        <div
          class="order-summary-line order-summary-total"
        >
          <span>Total</span>

          <strong>
            ${orderMoney(
              order.grandTotal
            )}
          </strong>
        </div>

        ${order.codAdvance?.enabled ? `
        <div class="order-summary-line">
          <span>Advance paid online</span>
          <strong>${orderMoney(order.codAdvance.advanceAmount)}</strong>
        </div>

        <div class="order-summary-line">
          <span>${order.codAdvance.balanceStatus === 'RECEIVED'
            ? 'Balance paid on delivery'
            : 'To pay on delivery (cash)'}</span>
          <strong>${orderMoney(order.codAdvance.balanceAmount)}</strong>
        </div>` : ''}



        <div class="delivery-address">

          <h3>
            Delivery Address
          </h3>

          <p>
            <strong>
              ${orderEsc(
                order.shippingAddress?.fullName || ''
              )}
            </strong>

            <br>

            ${orderEsc(
              order.shippingAddress?.addressLine || ''
            )}

            <br>

            ${orderEsc(
              order.shippingAddress?.city || ''
            )}

            ${
              order.shippingAddress?.city &&
              order.shippingAddress?.state
                ? ', '
                : ''
            }

            ${orderEsc(
              order.shippingAddress?.state || ''
            )}

            <br>

            PIN:
            ${orderEsc(
              order.shippingAddress?.pinCode || ''
            )}

            <br>

            Mobile:
            ${orderEsc(
              order.shippingAddress?.mobile || ''
            )}
          </p>

        </div>


        <div class="order-detail-buttons">

          <a
            class="order-detail-primary"
            href="${ORDER_BASE}/frontend/orders.html"
          >
            View My Orders
          </a>

          <a
            class="order-detail-secondary"
            href="${ORDER_BASE}/frontend/products.html"
          >
            Continue Shopping
          </a>

        </div>

      </aside>

    </div>
  `;


  /*
  ========================================
   LEGACY RAZORPAY RETRY

   Never offer this retry flow
   to COD or Cashfree orders.
  ========================================
  */

  if (
    order.paymentMethod === 'RAZORPAY' &&
    order.paymentStatus !== 'SUCCESS' &&
    order.orderStatus !== 'Cancelled'
  ) {
    const retryButton =
      document.createElement('button');

    retryButton.className =
      'retry-payment-btn';

    retryButton.id =
      'retryPaymentBtn';

    retryButton.type = 'button';

    retryButton.textContent =
      'Retry Online Payment';

    retryButton.onclick = async () => {
      await retryOnlinePayment(
        retryButton
      );
    };

    window.MC.$(
      '.order-detail-buttons'
    )?.appendChild(retryButton);
  }
}


/* =====================================
   LEGACY PAYMENT RETRY
===================================== */

async function retryOnlinePayment(
  button = null
) {
  if (
    retryPaymentRunning ||
    !currentOrderDetails?._id
  ) {
    return;
  }

  retryPaymentRunning = true;

  const oldText =
    button?.textContent ||
    'Retry Online Payment';

  if (button) {
    button.disabled = true;
    button.textContent = 'Please wait...';
  }

  try {
    const data = await window.MC.api(
      '/payment/retry/' +
      encodeURIComponent(
        currentOrderDetails._id
      ),
      {
        method: 'POST'
      }
    );

    if (
      !data.keyId ||
      !data.razorpayOrderId
    ) {
      throw new Error(
        'Payment retry order create nahi hua.'
      );
    }

    await loadOrderRazorpayScript();

    const razorpay = new window.Razorpay({
      key: data.keyId,
      amount: data.amount,
      currency: data.currency || 'INR',
      name: 'MEMORA CREATIONS',
      description: 'Retry Online Payment',
      order_id: data.razorpayOrderId,

      prefill: {
        name:
          currentOrderDetails.customer?.fullName ||
          currentOrderDetails.shippingAddress?.fullName ||
          '',

        email:
          currentOrderDetails.customer?.email ||
          '',

        contact:
          currentOrderDetails.customer?.mobile ||
          currentOrderDetails.shippingAddress?.mobile ||
          ''
      },

      theme: {
        color: '#8a5a3b'
      },

      modal: {
        ondismiss: () => {
          retryPaymentRunning = false;

          if (button) {
            button.disabled = false;
            button.textContent = oldText;
          }
        }
      },

      handler: async response => {
        try {
          const verified =
            await window.MC.api(
              '/payment/verify',
              {
                method: 'POST',
                body: JSON.stringify({
                  ...response,
                  orderId: data.orderId,
                  clearCart: false
                })
              }
            );

          if (!verified.order?._id) {
            throw new Error(
              'Payment verify hua lekin order ID nahi mila.'
            );
          }

          showOrderPaymentSuccess(
            verified.order._id
          );

        } catch (err) {
          retryPaymentRunning = false;

          if (button) {
            button.disabled = false;
            button.textContent = oldText;
          }

          window.MC.toast(
            err.message ||
            'Payment verification failed.',
            'error'
          );
        }
      }
    });

    razorpay.on(
      'payment.failed',
      response => {
        retryPaymentRunning = false;

        if (button) {
          button.disabled = false;
          button.textContent = oldText;
        }

        window.MC.toast(
          response?.error?.description ||
          'Payment failed. Please try again.',
          'error'
        );
      }
    );

    razorpay.open();

  } catch (err) {
    retryPaymentRunning = false;

    if (button) {
      button.disabled = false;
      button.textContent = oldText;
    }

    window.MC.toast(
      err.message ||
      'Payment retry failed.',
      'error'
    );
  }
}


/* =====================================
   START
===================================== */

loadOrderDetails().catch(err => {
  console.error(
    'Order details error:',
    err
  );

  const orderBox =
    window.MC.$('#order');

  if (orderBox) {
    orderBox.innerHTML = `
      <div class="empty">
        Order details load nahi ho pa rahe hain.
      </div>
    `;
  }

  window.MC.toast(
    err.message ||
    'Order details load failed.',
    'error'
  );
});
