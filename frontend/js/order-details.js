const ORDER_BASE =
  '/memora-creations';


let currentOrderDetails =
  null;


let retryPaymentRunning =
  false;


/* =========================
   DATE
========================= */

function formatOrderDetailsDate(
  value
) {

  if (!value) {
    return '';
  }


  try {

    return new Date(
      value
    )
      .toLocaleString(
        'en-IN',
        {
          day:
            '2-digit',

          month:
            'short',

          year:
            'numeric',

          hour:
            '2-digit',

          minute:
            '2-digit'
        }
      );

  } catch {

    return '';

  }

}


/* =========================
   STATUS CLASS
========================= */

function detailsStatusClass(
  status
) {

  const value =
    String(
      status || ''
    )
      .toLowerCase();


  if (
    value ===
    'cancelled'
  ) {

    return 'cancelled';

  }


  if (
    value ===
    'delivered'
  ) {

    return 'delivered';

  }


  if (
    value ===
    'shipped' ||
    value ===
    'out for delivery'
  ) {

    return 'shipping';

  }


  return 'processing';

}


/* =========================
   STATUS TITLE
========================= */

function getOrderStatusTitle(
  order
) {

  if (
    order.orderStatus ===
    'Cancelled'
  ) {

    return 'Order Cancelled';

  }


  if (
    order.orderStatus ===
    'Delivered'
  ) {

    return 'Order Delivered';

  }


  if (
    order.orderStatus ===
    'Out for Delivery'
  ) {

    return 'Out for Delivery';

  }


  if (
    order.orderStatus ===
    'Shipped'
  ) {

    return 'Order Shipped';

  }


  if (
    order.orderStatus ===
    'Packed'
  ) {

    return 'Order Packed';

  }


  return 'Order Confirmed';

}


/* =========================
   SUCCESS POPUP
========================= */

function showOrderPaymentSuccess(
  orderId
) {

  document
    .querySelector(
      '#orderPaymentSuccess'
    )
    ?.remove();


  const overlay =
    document.createElement(
      'div'
    );


  overlay.id =
    'orderPaymentSuccess';


  overlay.className =
    'order-success-popup';


  overlay.innerHTML = `

    <div class="order-success-popup-box">

      <div class="order-success-popup-icon">
        ✓
      </div>


      <h2>
        Payment Successful
      </h2>


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


  document.body.appendChild(
    overlay
  );


  overlay
    .querySelector(
      '#paymentSuccessContinue'
    )
    ?.addEventListener(
      'click',
      () => {

        location.href =
          ORDER_BASE +
          '/frontend/order-details.html?id=' +
          encodeURIComponent(
            orderId
          );

      }
    );

}


/* =========================
   RAZORPAY
========================= */

function loadOrderRazorpayScript() {

  return new Promise(
    (
      resolve,
      reject
    ) => {

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
          { once:true }
        );


        existingScript.addEventListener(
          'error',
          () =>
            reject(
              new Error(
                'Razorpay Checkout load nahi hua.'
              )
            ),
          { once:true }
        );


        return;

      }


      const script =
        document.createElement(
          'script'
        );


      script.src =
        'https://checkout.razorpay.com/v1/checkout.js';


      script.dataset.orderRazorpay =
        'true';


      script.onload =
        resolve;


      script.onerror =
        () =>
          reject(
            new Error(
              'Razorpay Checkout load nahi hua.'
            )
          );


      document.head.appendChild(
        script
      );

    }
  );

}


/* =========================
   PRODUCT HTML
========================= */

function orderDetailProducts(
  items
) {

  if (!items.length) {

    return `

      <div class="empty">
        No order items found.
      </div>

    `;

  }


  return items
    .map(
      item => `

        <div class="order-detail-product">

          <div class="order-detail-product-image">

            <img
              src="${window.MC.esc(
                item.imageUrl ||
                'https://placehold.co/180x180?text=Memora'
              )}"
              alt="${window.MC.esc(
                item.name ||
                'Product'
              )}"
            >

          </div>


          <div class="order-detail-product-info">

            <h3>

              ${window.MC.esc(
                item.name ||
                'Product'
              )}

            </h3>


            <span>

              Quantity:
              ${Number(
                item.quantity ||
                1
              )}

            </span>


            <span>

              Unit Price:
              ${window.MC.money(
                item.unitPrice
              )}

            </span>

          </div>


          <div class="order-detail-product-total">

            ${window.MC.money(
              item.lineTotal
            )}

          </div>

        </div>

      `
    )
    .join('');

}


/* =========================
   TRACKING
========================= */

function orderTrackingHtml(
  history
) {

  if (!history.length) {

    return `

      <div class="empty">
        Tracking update not available yet.
      </div>

    `;

  }


  return `

    <div class="tracking-list">

      ${
        history
          .map(
            status => `

              <div class="tracking-item">

                <span class="tracking-dot"></span>


                <strong>

                  ${window.MC.esc(
                    status.status ||
                    ''
                  )}

                </strong>


                <div class="tracking-date">

                  ${window.MC.esc(
                    formatOrderDetailsDate(
                      status.changedAt
                    )
                  )}

                </div>


                ${
                  status.note

                    ? `
                      <div class="tracking-note">

                        ${window.MC.esc(
                          status.note
                        )}

                      </div>
                    `

                    : ''
                }

              </div>

            `
          )
          .join('')
      }

    </div>

  `;

}


/* =========================
   LOAD ORDER
========================= */

async function loadOrderDetails() {

  const orderBox =
    window.MC.$(
      '#order'
    );


  if (!orderBox) {
    return;
  }


  const id =
    new URLSearchParams(
      location.search
    )
      .get('id');


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
    data.order ||
    null;


  if (
    !currentOrderDetails
  ) {

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
    Array.isArray(
      order.items
    )
      ? order.items
      : [];


  const history =
    Array.isArray(
      order.statusHistory
    )
      ? order.statusHistory
      : [];


  const statusTitle =
    getOrderStatusTitle(
      order
    );


  orderBox.innerHTML = `

    <section class="order-status-hero">

      <div>

        <div class="order-status-eyebrow">
          ORDER STATUS
        </div>


        <h1>
          ${window.MC.esc(
            statusTitle
          )}
        </h1>


        <p>

          Order ID:

          <strong>
            ${window.MC.esc(
              order.orderId ||
              ''
            )}
          </strong>

          •
          ${window.MC.esc(
            formatOrderDetailsDate(
              order.createdAt
            )
          )}

        </p>

      </div>


      <div
        class="order-status-badge ${detailsStatusClass(
          order.orderStatus
        )}"
      >

        ${window.MC.esc(
          order.orderStatus ||
          ''
        )}

      </div>

    </section>


    <div class="order-details-grid">


      <!-- LEFT -->

      <div>


        <section class="order-details-card">

          <div class="order-section-title">

            <span>
              YOUR ITEMS
            </span>

            <h2>
              Products
            </h2>

          </div>


          ${orderDetailProducts(
            items
          )}

        </section>


        <section class="order-details-card tracking-section">

          <div class="order-section-title">

            <span>
              TRACK YOUR ORDER
            </span>

            <h2>
              Order Tracking
            </h2>

          </div>


          ${orderTrackingHtml(
            history
          )}

        </section>

      </div>


      <!-- RIGHT -->

      <aside class="order-summary-card">

        <div class="order-section-title">

          <span>
            ORDER
          </span>

          <h2>
            Summary
          </h2>

        </div>


        <div class="order-summary-line">

          <span>
            Payment
          </span>

          <strong>

            ${
              order.paymentMethod ===
              'COD'

                ? 'Cash on Delivery'

                : 'Online Payment'
            }

          </strong>

        </div>


        <div class="order-summary-line">

          <span>
            Payment Status
          </span>

          <strong>

            ${window.MC.esc(
              order.paymentStatus ||
              ''
            )}

          </strong>

        </div>


        <div class="order-summary-line">

          <span>
            Order Status
          </span>

          <strong>

            ${window.MC.esc(
              order.orderStatus ||
              ''
            )}

          </strong>

        </div>


        <div class="order-summary-line">

          <span>
            Subtotal
          </span>

          <strong>

            ${window.MC.money(
              order.subtotal
            )}

          </strong>

        </div>


        <div class="order-summary-line">

          <span>
            Delivery
          </span>

          <strong>

            ${window.MC.money(
              order.deliveryCharge
            )}

          </strong>

        </div>


        <div class="order-summary-line">

          <span>
            You Save
          </span>

          <strong>

            ${window.MC.money(
              order.discount
            )}

          </strong>

        </div>


        <div
          class="order-summary-line order-summary-total"
        >

          <span>
            Total
          </span>

          <strong>

            ${window.MC.money(
              order.grandTotal
            )}

          </strong>

        </div>


        <div class="delivery-address">

          <h3>
            Delivery Address
          </h3>


          <p>

            <strong>

              ${window.MC.esc(
                order.shippingAddress
                  ?.fullName ||
                ''
              )}

            </strong>

            <br>

            ${window.MC.esc(
              order.shippingAddress
                ?.addressLine ||
              ''
            )}

            <br>

            ${window.MC.esc(
              order.shippingAddress
                ?.city ||
              ''
            )}

            ${
              order.shippingAddress
                ?.city &&
              order.shippingAddress
                ?.state

                ? ', '
                : ''
            }

            ${window.MC.esc(
              order.shippingAddress
                ?.state ||
              ''
            )}

            <br>

            PIN:
            ${window.MC.esc(
              order.shippingAddress
                ?.pinCode ||
              ''
            )}

            <br>

            Mobile:
            ${window.MC.esc(
              order.shippingAddress
                ?.mobile ||
              ''
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


  /* RETRY PAYMENT */

  if (
    order.paymentMethod ===
      'RAZORPAY' &&
    order.paymentStatus !==
      'SUCCESS' &&
    order.orderStatus !==
      'Cancelled'
  ) {

    const retryButton =
      document.createElement(
        'button'
      );


    retryButton.className =
      'retry-payment-btn';


    retryButton.id =
      'retryPaymentBtn';


    retryButton.type =
      'button';


    retryButton.textContent =
      'Retry Online Payment';


    retryButton.onclick =
      async () => {

        await retryOnlinePayment(
          retryButton
        );

      };


    window.MC
      .$('.order-detail-buttons')
      ?.appendChild(
        retryButton
      );

  }

}


/* =========================
   RETRY PAYMENT
========================= */

async function retryOnlinePayment(
  button = null
) {

  if (
    retryPaymentRunning ||
    !currentOrderDetails?._id
  ) {

    return;

  }


  retryPaymentRunning =
    true;


  const oldText =
    button?.textContent ||
    'Retry Online Payment';


  if (button) {

    button.disabled =
      true;


    button.textContent =
      'Please wait...';

  }


  try {

    const data =
      await window.MC.api(
        '/payment/retry/' +
        encodeURIComponent(
          currentOrderDetails._id
        ),
        {
          method:'POST'
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


    const razorpay =
      new window.Razorpay({

        key:
          data.keyId,

        amount:
          data.amount,

        currency:
          data.currency ||
          'INR',

        name:
          'MEMORA CREATIONS',

        description:
          'Retry Online Payment',

        order_id:
          data.razorpayOrderId,

        prefill: {

          name:
            currentOrderDetails
              .customer
              ?.fullName ||
            currentOrderDetails
              .shippingAddress
              ?.fullName ||
            '',

          email:
            currentOrderDetails
              .customer
              ?.email ||
            '',

          contact:
            currentOrderDetails
              .customer
              ?.mobile ||
            currentOrderDetails
              .shippingAddress
              ?.mobile ||
            ''

        },

        theme: {
          color:'#8a5a3b'
        },

        modal: {

          ondismiss:
            () => {

              retryPaymentRunning =
                false;


              if (button) {

                button.disabled =
                  false;


                button.textContent =
                  oldText;

              }

            }

        },

        handler:
          async response => {

            try {

              const verified =
                await window.MC.api(
                  '/payment/verify',
                  {

                    method:'POST',

                    body:
                      JSON.stringify({

                        ...response,

                        orderId:
                          data.orderId,

                        clearCart:
                          false

                      })

                  }
                );


              if (
                !verified.order?._id
              ) {

                throw new Error(
                  'Payment verify hua lekin order ID nahi mila.'
                );

              }


              showOrderPaymentSuccess(
                verified.order._id
              );


            } catch (error) {

              retryPaymentRunning =
                false;


              if (button) {

                button.disabled =
                  false;


                button.textContent =
                  oldText;

              }


              window.MC.toast(
                error.message ||
                'Payment verification failed.',
                'error'
              );

            }

          }

      });


    razorpay.on(
      'payment.failed',
      response => {

        retryPaymentRunning =
          false;


        if (button) {

          button.disabled =
            false;


          button.textContent =
            oldText;

        }


        window.MC.toast(
          response?.error
            ?.description ||
          'Payment failed. Please try again.',
          'error'
        );

      }
    );


    razorpay.open();


  } catch (error) {

    retryPaymentRunning =
      false;


    if (button) {

      button.disabled =
        false;


      button.textContent =
        oldText;

    }


    window.MC.toast(
      error.message ||
      'Payment retry failed.',
      'error'
    );

  }

}


/* =========================
   START
========================= */

loadOrderDetails()
  .catch(
    error => {

      console.error(
        'Order details error:',
        error
      );


      const orderBox =
        window.MC.$(
          '#order'
        );


      if (orderBox) {

        orderBox.innerHTML = `

          <div class="empty">
            Order details load nahi ho pa rahe hain.
          </div>

        `;

      }


      window.MC.toast(
        error.message ||
        'Order details load failed.',
        'error'
      );

    }
  );
