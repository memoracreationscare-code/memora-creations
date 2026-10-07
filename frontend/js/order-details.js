const ORDER_BASE =
  '/memora-creations';


let currentOrderDetails =
  null;


let retryPaymentRunning =
  false;


/* =========================
   FORMAT DATE
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
        'en-IN'
      );

  } catch {

    return '';

  }

}


/* =========================
   LOAD RAZORPAY
========================= */

function loadOrderRazorpayScript() {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      if (
        window.Razorpay
      ) {

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
          () => resolve(),
          {
            once: true
          }
        );


        existingScript.addEventListener(
          'error',
          () =>
            reject(
              new Error(
                'Razorpay Checkout load nahi hua.'
              )
            ),
          {
            once: true
          }
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
        () => resolve();


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
   LOAD ORDER
========================= */

async function loadOrderDetails() {

  const user =
    await window.MC
      .requireLogin();


  if (!user) {
    return;
  }


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


    window.MC.toast(
      'Order ID is missing.',
      'error'
    );


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


  orderBox.innerHTML = `

    <div
      class="message success"
      style="
        font-size:18px;
        margin-bottom:20px;
      "
    >
      ✅ Your order has been confirmed successfully!
    </div>


    <div class="two">

      <div>

        <h1>
          Order Confirmed
        </h1>


        <p>

          Order ID:

          <b>
            ${window.MC.esc(
              order.orderId || ''
            )}
          </b>

        </p>


        <p class="muted">

          ${window.MC.esc(
            formatOrderDetailsDate(
              order.createdAt
            )
          )}

        </p>


        <div class="card">

          <div class="cardbody">

            ${
              items.length

                ? items
                    .map(
                      item => `

                        <div
                          class="orderrow"
                        >

                          <img
                            src="${window.MC.esc(
                              item.imageUrl ||
                              'https://placehold.co/80x80?text=Memora'
                            )}"
                            width="70"
                            height="70"
                            alt="${window.MC.esc(
                              item.name ||
                              'Product'
                            )}"
                            style="
                              object-fit:cover;
                              border-radius:10px;
                            "
                          >


                          <div>

                            <b>

                              ${window.MC.esc(
                                item.name ||
                                'Product'
                              )}

                            </b>


                            <div
                              class="muted"
                            >

                              Quantity:
                              ${Number(
                                item.quantity ||
                                1
                              )}

                            </div>

                          </div>


                          <b>

                            ${window.MC.money(
                              item.lineTotal
                            )}

                          </b>

                        </div>

                      `
                    )
                    .join('')

                : `

                    <div class="empty">
                      No order items found.
                    </div>

                  `
            }

          </div>

        </div>


        <h2>
          Order Tracking
        </h2>


        <div class="timeline">

          ${
            history.length

              ? history
                  .map(
                    status => `

                      <div
                        class="timelineitem"
                      >

                        <b>

                          ${window.MC.esc(
                            status.status ||
                            ''
                          )}

                        </b>


                        <div
                          class="muted"
                        >

                          ${window.MC.esc(
                            formatOrderDetailsDate(
                              status.changedAt
                            )
                          )}

                        </div>


                        <div>

                          ${window.MC.esc(
                            status.note ||
                            ''
                          )}

                        </div>

                      </div>

                    `
                  )
                  .join('')

              : `

                  <div class="empty">
                    Tracking update not available yet.
                  </div>

                `
          }

        </div>

      </div>


      <aside
        class="summary"
      >

        <h2>
          Order Summary
        </h2>


        <div
          class="summaryline"
        >

          <span>
            Payment
          </span>

          <b>

            ${
              order.paymentMethod ===
              'COD'

                ? 'Cash on Delivery'

                : 'Online Payment'
            }

          </b>

        </div>


        <div
          class="summaryline"
        >

          <span>
            Payment Status
          </span>

          <b>

            ${window.MC.esc(
              order.paymentStatus ||
              ''
            )}

          </b>

        </div>


        <div
          class="summaryline"
        >

          <span>
            Order Status
          </span>

          <b>

            ${window.MC.esc(
              order.orderStatus ||
              ''
            )}

          </b>

        </div>


        <div
          class="summaryline"
        >

          <span>
            Subtotal
          </span>

          <b>

            ${window.MC.money(
              order.subtotal
            )}

          </b>

        </div>


        <div
          class="summaryline"
        >

          <span>
            Delivery
          </span>

          <b>

            ${window.MC.money(
              order.deliveryCharge
            )}

          </b>

        </div>


        <div
          class="summaryline"
        >

          <span>
            You Save
          </span>

          <b>

            ${window.MC.money(
              order.discount
            )}

          </b>

        </div>


        <div
          class="summaryline total"
        >

          <span>
            Total
          </span>

          <b>

            ${window.MC.money(
              order.grandTotal
            )}

          </b>

        </div>


        <h3>
          Delivery Address
        </h3>


        <p>

          ${window.MC.esc(
            order.shippingAddress
              ?.fullName ||
            ''
          )}

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


        <a
          class="btn"
          href="${ORDER_BASE}/frontend/orders.html"
        >
          View My Orders
        </a>


        <a
          class="btn secondary"
          href="${ORDER_BASE}/frontend/index.html"
          style="
            margin-top:10px;
          "
        >
          Continue Shopping
        </a>

      </aside>

    </div>

  `;


  /* =========================
     RETRY PAYMENT BUTTON
  ========================= */

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
      'btn';


    retryButton.id =
      'retryPaymentBtn';


    retryButton.type =
      'button';


    retryButton.textContent =
      'Retry Online Payment';


    retryButton.style.marginTop =
      '10px';


    retryButton.onclick =
      async () => {

        await retryOnlinePayment(
          retryButton
        );

      };


    window.MC
      .$('#order .summary')
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

          method:
            'POST'

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

                    method:
                      'POST',

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


              alert(
                '✅ Payment successful! Your order is confirmed.'
              );


              location.href =
                ORDER_BASE +
                '/frontend/order-details.html?id=' +
                encodeURIComponent(
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
      async response => {

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
