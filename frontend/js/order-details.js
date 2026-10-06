const ORDER_BASE = '/memora-creations';

let currentOrderDetails = null;


/* =========================
   LOAD ORDER
========================= */

async function loadOrderDetails() {

  const user =
    await window.MC.requireLogin();

  if (!user) return;


  const id =
    new URLSearchParams(
      location.search
    ).get('id');


  if (!id) {

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
    data.order;


  const order =
    currentOrderDetails;


  window.MC.$('#order').innerHTML = `

    <div
      class="message success"
      style="font-size:18px; margin-bottom:20px;"
    >
      ✅ Your order has been confirmed successfully!
    </div>


    <div class="two">

      <div>

        <h1>Order Confirmed</h1>

        <p>
          Order ID:
          <b>
            ${window.MC.esc(order.orderId)}
          </b>
        </p>

        <p class="muted">
          ${new Date(
            order.createdAt
          ).toLocaleString('en-IN')}
        </p>


        <div class="card">

          <div class="cardbody">

            ${(order.items || [])
              .map(item => `

                <div class="orderrow">

                  <img
                    src="${window.MC.esc(
                      item.imageUrl ||
                      'https://placehold.co/80'
                    )}"
                    width="70"
                    alt="${window.MC.esc(item.name)}"
                  >

                  <div>

                    <b>
                      ${window.MC.esc(item.name)}
                    </b>

                    <div class="muted">
                      Quantity:
                      ${item.quantity}
                    </div>

                  </div>

                  <b>
                    ${window.MC.money(
                      item.lineTotal
                    )}
                  </b>

                </div>

              `)
              .join('')}

          </div>

        </div>


        <h2>Order Tracking</h2>

        <div class="timeline">

          ${(order.statusHistory || [])
            .map(status => `

              <div class="timelineitem">

                <b>
                  ${window.MC.esc(
                    status.status
                  )}
                </b>

                <div class="muted">

                  ${
                    status.changedAt
                      ? new Date(
                          status.changedAt
                        ).toLocaleString(
                          'en-IN'
                        )
                      : ''
                  }

                </div>

                <div>
                  ${window.MC.esc(
                    status.note || ''
                  )}
                </div>

              </div>

            `)
            .join('')}

        </div>

      </div>


      <aside class="summary">

        <h2>Order Summary</h2>


        <div class="summaryline">

          <span>Payment</span>

          <b>
            ${
              order.paymentMethod === 'COD'
                ? 'Cash on Delivery'
                : 'Online Payment'
            }
          </b>

        </div>


        <div class="summaryline">

          <span>Payment Status</span>

          <b>
            ${window.MC.esc(
              order.paymentStatus
            )}
          </b>

        </div>


        <div class="summaryline">

          <span>Order Status</span>

          <b>
            ${window.MC.esc(
              order.orderStatus
            )}
          </b>

        </div>


        <div class="summaryline">

          <span>Subtotal</span>

          <b>
            ${window.MC.money(
              order.subtotal
            )}
          </b>

        </div>


        <div class="summaryline">

          <span>Delivery</span>

          <b>
            ${window.MC.money(
              order.deliveryCharge
            )}
          </b>

        </div>


        <div class="summaryline">

          <span>You Save</span>

          <b>
            ${window.MC.money(
              order.discount
            )}
          </b>

        </div>


        <div class="summaryline total">

          <span>Total</span>

          <b>
            ${window.MC.money(
              order.grandTotal
            )}
          </b>

        </div>


        <h3>Delivery Address</h3>

        <p>

          ${window.MC.esc(
            order.shippingAddress?.fullName || ''
          )}

          <br>

          ${window.MC.esc(
            order.shippingAddress?.addressLine || ''
          )}

          <br>

          ${window.MC.esc(
            order.shippingAddress?.city || ''
          )}

          ${order.shippingAddress?.state ? ',' : ''}

          ${window.MC.esc(
            order.shippingAddress?.state || ''
          )}

          <br>

          PIN:
          ${window.MC.esc(
            order.shippingAddress?.pinCode || ''
          )}

          <br>

          Mobile:
          ${window.MC.esc(
            order.shippingAddress?.mobile || ''
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
          style="margin-top:10px;"
        >
          Continue Shopping
        </a>

      </aside>

    </div>
  `;


  /* RETRY ONLINE PAYMENT */

  if (
    order.paymentMethod === 'RAZORPAY' &&
    order.paymentStatus !== 'SUCCESS' &&
    order.orderStatus !== 'Cancelled'
  ) {

    const retryButton =
      document.createElement('button');

    retryButton.className =
      'btn';

    retryButton.textContent =
      'Retry Online Payment';

    retryButton.style.marginTop =
      '10px';

    retryButton.onclick =
      retryOnlinePayment;

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

async function retryOnlinePayment() {

  try {

    const data =
      await window.MC.api(
        '/payment/retry/' +
        encodeURIComponent(
          currentOrderDetails._id
        ),
        {
          method: 'POST'
        }
      );


    const script =
      document.createElement(
        'script'
      );


    script.src =
      'https://checkout.razorpay.com/v1/checkout.js';


    script.onload = () => {

      const razorpay =
        new Razorpay({

          key:
            data.keyId,

          amount:
            data.amount,

          currency:
            data.currency,

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
                ?.fullName || '',

            email:
              currentOrderDetails
                .customer
                ?.email || '',

            contact:
              currentOrderDetails
                .customer
                ?.mobile || ''

          },


          handler:
            async response => {

              try {

                const verified =
                  await window.MC.api(
                    '/payment/verify',
                    {
                      method: 'POST',

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


                alert(
                  'Payment successful! Your order is confirmed.'
                );


                location.href =
                  ORDER_BASE +
                  '/frontend/order-details.html?id=' +
                  encodeURIComponent(
                    verified.order._id
                  );


              } catch (error) {

                window.MC.toast(
                  error.message ||
                  'Payment verification failed.',
                  'error'
                );

              }

            }

        });


      razorpay.open();

    };


    script.onerror = () => {

      window.MC.toast(
        'Razorpay Checkout load nahi hua.',
        'error'
      );

    };


    document.head.appendChild(
      script
    );


  } catch (error) {

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

loadOrderDetails().catch(
  error => {

    console.error(
      'Order details error:',
      error
    );

    window.MC.toast(
      error.message ||
      'Order details load failed.',
      'error'
    );

  }
);
