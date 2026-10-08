const SUCCESS_BASE =
  '/memora-creations';


function formatSuccessDate(
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
          day:'2-digit',
          month:'short',
          year:'numeric',
          hour:'2-digit',
          minute:'2-digit'
        }
      );

  } catch {

    return '';

  }

}


async function loadOrderSuccess() {

  const box =
    window.MC.$(
      '#orderSuccess'
    );


  if (!box) {
    return;
  }


  const id =
    new URLSearchParams(
      location.search
    )
      .get('id');


  if (!id) {

    box.innerHTML = `

      <div class="success-error">

        <h2>
          Order information missing
        </h2>

        <p>
          Order confirmation load nahi ho pa raha hai.
        </p>

        <a
          class="success-btn primary"
          href="${SUCCESS_BASE}/frontend/orders.html"
        >
          View My Orders
        </a>

      </div>

    `;

    return;

  }


  try {

    const data =
      await window.MC.api(
        '/orders/' +
        encodeURIComponent(id)
      );


    const order =
      data.order;


    if (!order) {

      throw new Error(
        'Order not found.'
      );

    }


    const paymentLabel =
      order.paymentMethod ===
      'COD'

        ? 'Cash on Delivery'

        : 'Online Payment';


    box.innerHTML = `

      <section class="success-card">

        <div class="success-icon">
          ✓
        </div>


        <div class="success-eyebrow">
          THANK YOU FOR SHOPPING
        </div>


        <h1>
          Order Confirmed
        </h1>


        <p class="success-message">
          Thank you for shopping with Memora Creations.
          Aapka order successfully receive ho gaya hai.
          Neeche order ki important details di gayi hain.
        </p>


        <div class="success-order-box">


          <div class="success-info-row">

            <span>
              Order ID
            </span>

            <strong>
              ${window.MC.esc(
                order.orderId ||
                ''
              )}
            </strong>

          </div>


          <div class="success-info-row">

            <span>
              Date
            </span>

            <strong>
              ${window.MC.esc(
                formatSuccessDate(
                  order.createdAt
                )
              )}
            </strong>

          </div>


          <div class="success-info-row">

            <span>
              Payment
            </span>

            <strong>
              ${window.MC.esc(
                paymentLabel
              )}
            </strong>

          </div>


          <div class="success-info-row">

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


          <div class="success-info-row">

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


          <div class="success-info-row success-total">

            <span>
              Order Total
            </span>

            <strong>
              ${window.MC.money(
                order.grandTotal
              )}
            </strong>

          </div>

        </div>


        <div class="success-actions">

          <a
            class="success-btn primary"
            href="${SUCCESS_BASE}/frontend/order-details.html?id=${encodeURIComponent(
              order._id
            )}"
          >
            View / Track Order
          </a>


          <a
            class="success-btn secondary"
            href="${SUCCESS_BASE}/frontend/orders.html"
          >
            My Orders
          </a>


          <a
            class="success-btn success-shop"
            href="${SUCCESS_BASE}/frontend/products.html"
          >
            Continue Shopping
          </a>

        </div>


        <div class="success-note">
          Order ya delivery se related help ke liye
          Memora Creations Customer Care se contact karein.
        </div>

      </section>

    `;


  } catch (error) {

    console.error(
      'Order success load error:',
      error
    );


    box.innerHTML = `

      <div class="success-error">

        <h2>
          Confirmation load nahi hua
        </h2>

        <p>
          Aap My Orders page se apna order check kar sakte hain.
        </p>

        <a
          class="success-btn primary"
          href="${SUCCESS_BASE}/frontend/orders.html"
        >
          View My Orders
        </a>

      </div>

    `;

  }

}


loadOrderSuccess();
