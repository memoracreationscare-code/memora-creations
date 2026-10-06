const CHECKOUT_BASE = '/memora-creations';

let checkoutItems = [];
let checkoutUser = null;
let checkoutFromCart = false;


/* =========================
   INIT CHECKOUT
========================= */

async function initCheckout() {

  checkoutUser =
    await window.MC.requireLogin();

  if (!checkoutUser) return;


  const params =
    new URLSearchParams(location.search);


  if (params.get('buyNow')) {

    checkoutItems = [
      {
        productId: params.get('buyNow'),
        quantity: Number(
          params.get('qty') || 1
        )
      }
    ];

  } else {

    checkoutFromCart = true;

    const cartData =
      await window.MC.api('/cart');

    checkoutItems =
      (cartData.cart?.items || [])
        .map(item => ({
          productId:
            item.product._id,
          quantity:
            item.quantity
        }));

  }


  if (!checkoutItems.length) {

    window.MC.$('#checkout').innerHTML = `
      <div class="empty">
        Cart is empty.
      </div>
    `;

    return;
  }


  /* ORDER PREVIEW */

  const preview =
    await window.MC.api(
      '/orders/preview',
      {
        method: 'POST',
        body: JSON.stringify({
          items: checkoutItems
        })
      }
    );


  window.MC.$('#summary').innerHTML = `

    ${(preview.items || [])
      .map(item => `
        <div class="summaryline">

          <span>
            ${window.MC.esc(item.name)}
            × ${item.quantity}
          </span>

          <b>
            ${window.MC.money(
              item.lineTotal
            )}
          </b>

        </div>
      `)
      .join('')}


    <div class="summaryline">

      <span>Delivery</span>

      <b>
        ${window.MC.money(
          preview.deliveryCharge
        )}
      </b>

    </div>


    <div class="summaryline">

      <span>Discount</span>

      <b>
        −${window.MC.money(
          preview.discount
        )}
      </b>

    </div>


    <div class="summaryline total">

      <span>Total</span>

      <b>
        ${window.MC.money(
          preview.grandTotal
        )}
      </b>

    </div>
  `;


  /* AUTO FILL ADDRESS */

  const defaultAddress =
    checkoutUser.addresses?.find(
      address => address.isDefault
    ) ||
    checkoutUser.addresses?.[0];


  if (defaultAddress) {

    const fields = [
      'fullName',
      'mobile',
      'addressLine',
      'pinCode',
      'city',
      'state'
    ];


    fields.forEach(field => {

      const input =
        window.MC.$('#' + field);

      if (input) {
        input.value =
          defaultAddress[field] || '';
      }

    });

  } else {

    if (window.MC.$('#fullName')) {
      window.MC.$('#fullName').value =
        checkoutUser.fullName || '';
    }

    if (window.MC.$('#mobile')) {
      window.MC.$('#mobile').value =
        checkoutUser.mobile || '';
    }

  }

}


/* =========================
   ADDRESS
========================= */

function getCheckoutAddress() {

  return {

    fullName:
      window.MC.$('#fullName')
        .value.trim(),

    mobile:
      window.MC.$('#mobile')
        .value.trim(),

    addressLine:
      window.MC.$('#addressLine')
        .value.trim(),

    pinCode:
      window.MC.$('#pinCode')
        .value.trim(),

    city:
      window.MC.$('#city')
        .value.trim(),

    state:
      window.MC.$('#state')
        .value.trim()

  };

}


/* =========================
   CASH ON DELIVERY
========================= */

async function placeCodOrder() {

  try {

    const data =
      await window.MC.api(
        '/orders/cod',
        {
          method: 'POST',

          body: JSON.stringify({

            items: checkoutItems,

            address:
              getCheckoutAddress(),

            clearCart:
              checkoutFromCart

          })
        }
      );


    location.href =
      CHECKOUT_BASE +
      '/frontend/order-details.html?id=' +
      encodeURIComponent(
        data.order._id
      );


  } catch (error) {

    window.MC.toast(
      error.message ||
      'Order place nahi hua.',
      'error'
    );

  }

}


/* =========================
   ONLINE PAYMENT
========================= */

async function placeOnlineOrder() {

  try {

    const data =
      await window.MC.api(
        '/payment/create-order',
        {
          method: 'POST',

          body: JSON.stringify({

            items:
              checkoutItems,

            address:
              getCheckoutAddress(),

            clearCart:
              checkoutFromCart

          })
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

          key: data.keyId,

          amount: data.amount,

          currency:
            data.currency,

          name:
            'MEMORA CREATIONS',

          description:
            'E-commerce Order',

          order_id:
            data.razorpayOrderId,

          prefill: {

            name:
              checkoutUser.fullName || '',

            email:
              checkoutUser.email || '',

            contact:
              checkoutUser.mobile || ''

          },

          theme: {
            color: '#8a5a3b'
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
                            data.orderId
                        })
                    }
                  );


                location.href =
                  CHECKOUT_BASE +
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


      razorpay.on(
        'payment.failed',
        async () => {

          await window.MC.api(
            '/payment/fail',
            {
              method: 'POST',

              body: JSON.stringify({
                orderId:
                  data.orderId
              })
            }
          ).catch(() => {});


          window.MC.toast(
            'Payment failed. Please try again.',
            'error'
          );

        }
      );


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
      'Online payment start nahi hua.',
      'error'
    );

  }

}


/* =========================
   FORM SUBMIT
========================= */

const checkoutForm =
  window.MC.$('#checkoutForm');


if (checkoutForm) {

  checkoutForm.addEventListener(
    'submit',
    async event => {

      event.preventDefault();


      if (
        !window.MC.$('#terms').checked
      ) {

        window.MC.toast(
          'Please accept order confirmation.',
          'error'
        );

        return;
      }


      const method =
        document.querySelector(
          'input[name="paymentMethod"]:checked'
        )?.value;


      if (method === 'COD') {

        await placeCodOrder();

      } else {

        await placeOnlineOrder();

      }

    }
  );

}


/* =========================
   START
========================= */

initCheckout().catch(error => {

  console.error(
    'Checkout init error:',
    error
  );

  window.MC.toast(
    error.message ||
    'Checkout load failed.',
    'error'
  );

});
