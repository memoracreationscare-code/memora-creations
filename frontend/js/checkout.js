const CHECKOUT_BASE =
  '/memora-creations';


let checkoutItems = [];
let checkoutUser = null;
let checkoutFromCart = false;
let orderSubmitting = false;


/* =========================
   HELPERS
========================= */

function isValidCheckoutMobile(
  value
) {

  return /^[6-9][0-9]{9}$/
    .test(
      String(value || '')
        .trim()
    );

}


function isValidCheckoutPin(
  value
) {

  return /^[0-9]{6}$/
    .test(
      String(value || '')
        .trim()
    );

}


/* =========================
   GET ADDRESS
========================= */

function getCheckoutAddress() {

  return {

    fullName:
      window.MC.$(
        '#fullName'
      )
        ?.value
        .trim() ||
      '',


    mobile:
      window.MC.$(
        '#mobile'
      )
        ?.value
        .trim() ||
      '',


    addressLine:
      window.MC.$(
        '#addressLine'
      )
        ?.value
        .trim() ||
      '',


    pinCode:
      window.MC.$(
        '#pinCode'
      )
        ?.value
        .trim() ||
      '',


    city:
      window.MC.$(
        '#city'
      )
        ?.value
        .trim() ||
      '',


    state:
      window.MC.$(
        '#state'
      )
        ?.value
        .trim() ||
      ''

  };

}


/* =========================
   VALIDATE ADDRESS
========================= */

function validateCheckoutAddress() {

  const address =
    getCheckoutAddress();


  if (!address.fullName) {

    window.MC.toast(
      'Full Name required hai.',
      'error'
    );

    return false;

  }


  if (
    !isValidCheckoutMobile(
      address.mobile
    )
  ) {

    window.MC.toast(
      'Valid 10 digit mobile number dalo.',
      'error'
    );

    return false;

  }


  if (!address.addressLine) {

    window.MC.toast(
      'Address required hai.',
      'error'
    );

    return false;

  }


  if (
    !isValidCheckoutPin(
      address.pinCode
    )
  ) {

    window.MC.toast(
      'Valid 6 digit PIN Code dalo.',
      'error'
    );

    return false;

  }


  return true;

}


/* =========================
   BUTTON LOADING
========================= */

function setCheckoutLoading(
  loading
) {

  const button =
    document.querySelector(
      '#checkoutForm button[type="submit"]'
    );


  if (!button) {
    return;
  }


  button.disabled =
    loading;


  button.textContent =
    loading
      ? 'Please wait...'
      : 'Place Order / Pay';

}


/* =========================
   LOAD RAZORPAY SCRIPT
========================= */

function loadRazorpayScript() {

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
          'script[data-razorpay-checkout="true"]'
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
          () => reject(
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


      script.dataset
        .razorpayCheckout =
        'true';


      script.onload =
        () => resolve();


      script.onerror =
        () => reject(
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
   INIT CHECKOUT
========================= */

async function initCheckout() {

  checkoutUser =
    await window.MC
      .requireLogin();


  if (!checkoutUser) {
    return;
  }


  const checkoutBox =
    window.MC.$(
      '#checkout'
    );


  const summaryBox =
    window.MC.$(
      '#summary'
    );


  if (
    !checkoutBox ||
    !summaryBox
  ) {

    return;

  }


  const params =
    new URLSearchParams(
      location.search
    );


  const buyNowId =
    params.get(
      'buyNow'
    );


  if (buyNowId) {

    checkoutFromCart =
      false;


    const requestedQty =
      Math.max(
        1,
        Number(
          params.get(
            'qty'
          ) || 1
        )
      );


    checkoutItems = [

      {
        productId:
          buyNowId,

        quantity:
          requestedQty
      }

    ];

  } else {

    checkoutFromCart =
      true;


    const cartData =
      await window.MC.api(
        '/cart'
      );


    checkoutItems =
      (
        cartData.cart?.items ||
        []
      )
        .filter(
          item =>
            item.product?._id
        )
        .map(
          item => ({

            productId:
              item.product._id,

            quantity:
              Math.max(
                1,
                Number(
                  item.quantity ||
                  1
                )
              )

          })
        );

  }


  if (
    !checkoutItems.length
  ) {

    checkoutBox.innerHTML = `

      <div class="empty">
        Cart is empty.
      </div>

    `;


    return;

  }


  /* =========================
     ORDER PREVIEW
  ========================= */

  const preview =
    await window.MC.api(
      '/orders/preview',
      {

        method:
          'POST',

        body:
          JSON.stringify({

            items:
              checkoutItems

          })

      }
    );


  summaryBox.innerHTML = `

    ${
      (
        preview.items ||
        []
      )
        .map(
          item => `

            <div
              class="summaryline"
            >

              <span>

                ${window.MC.esc(
                  item.name ||
                  'Product'
                )}

                ×
                ${Number(
                  item.quantity ||
                  1
                )}

              </span>


              <b>

                ${window.MC.money(
                  item.lineTotal
                )}

              </b>

            </div>

          `
        )
        .join('')
    }


    <div
      class="summaryline"
    >

      <span>
        Delivery
      </span>

      <b>

        ${window.MC.money(
          preview.deliveryCharge
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
          preview.discount
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
          preview.grandTotal
        )}

      </b>

    </div>

  `;


  /* =========================
     AUTO FILL ADDRESS
  ========================= */

  const addresses =
    Array.isArray(
      checkoutUser.addresses
    )

      ? checkoutUser.addresses

      : [];


  const defaultAddress =
    addresses.find(
      address =>
        address.isDefault
    ) ||
    addresses[0];


  if (defaultAddress) {

    const fields = [
      'fullName',
      'mobile',
      'addressLine',
      'pinCode',
      'city',
      'state'
    ];


    fields.forEach(
      field => {

        const input =
          window.MC.$(
            '#' + field
          );


        if (input) {

          input.value =
            defaultAddress[field] ||
            '';

        }

      }
    );

  } else {

    const fullNameInput =
      window.MC.$(
        '#fullName'
      );


    const mobileInput =
      window.MC.$(
        '#mobile'
      );


    if (fullNameInput) {

      fullNameInput.value =
        checkoutUser.fullName ||
        '';

    }


    if (mobileInput) {

      mobileInput.value =
        checkoutUser.mobile ||
        '';

    }

  }

}


/* =========================
   CASH ON DELIVERY
========================= */

async function placeCodOrder() {

  if (orderSubmitting) {
    return;
  }


  if (
    !validateCheckoutAddress()
  ) {

    return;

  }


  orderSubmitting =
    true;


  setCheckoutLoading(
    true
  );


  try {

    const data =
      await window.MC.api(
        '/orders/cod',
        {

          method:
            'POST',

          body:
            JSON.stringify({

              items:
                checkoutItems,

              address:
                getCheckoutAddress(),

              clearCart:
                checkoutFromCart

            })

        }
      );


    if (
      !data.order?._id
    ) {

      throw new Error(
        'Order create hua lekin order ID nahi mila.'
      );

    }


    alert(
      '✅ Order Confirmed Successfully!\n\nThank you for shopping with Memora Creations.'
    );


    location.href =
      CHECKOUT_BASE +
      '/frontend/order-details.html?id=' +
      encodeURIComponent(
        data.order._id
      );


  } catch (error) {

    orderSubmitting =
      false;


    setCheckoutLoading(
      false
    );


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

  if (orderSubmitting) {
    return;
  }


  if (
    !validateCheckoutAddress()
  ) {

    return;

  }


  orderSubmitting =
    true;


  setCheckoutLoading(
    true
  );


  try {

    const data =
      await window.MC.api(
        '/payment/create-order',
        {

          method:
            'POST',

          body:
            JSON.stringify({

              items:
                checkoutItems,

              address:
                getCheckoutAddress(),

              clearCart:
                checkoutFromCart

            })

        }
      );


    if (
      !data.razorpayOrderId ||
      !data.keyId
    ) {

      throw new Error(
        'Payment order create nahi hua.'
      );

    }


    await loadRazorpayScript();


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
          'E-commerce Order',


        order_id:
          data.razorpayOrderId,


        prefill: {

          name:
            checkoutUser.fullName ||
            '',


          email:
            checkoutUser.email ||
            '',


          contact:
            checkoutUser.mobile ||
            ''

        },


        theme: {

          color:
            '#8a5a3b'

        },


        modal: {

          ondismiss:
            () => {

              orderSubmitting =
                false;


              setCheckoutLoading(
                false
              );

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
                          data.orderId

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
                '✅ Payment Successful!\n\nYour order has been confirmed.'
              );


              location.href =
                CHECKOUT_BASE +
                '/frontend/order-details.html?id=' +
                encodeURIComponent(
                  verified.order._id
                );


            } catch (error) {

              orderSubmitting =
                false;


              setCheckoutLoading(
                false
              );


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

        await window.MC.api(
          '/payment/fail',
          {

            method:
              'POST',

            body:
              JSON.stringify({

                orderId:
                  data.orderId,

                reason:
                  response?.error
                    ?.description ||
                  'Payment failed'

              })

          }
        )
          .catch(
            () => {}
          );


        orderSubmitting =
          false;


        setCheckoutLoading(
          false
        );


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

    orderSubmitting =
      false;


    setCheckoutLoading(
      false
    );


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
  window.MC.$(
    '#checkoutForm'
  );


if (checkoutForm) {

  checkoutForm.addEventListener(
    'submit',
    async event => {

      event.preventDefault();


      if (orderSubmitting) {
        return;
      }


      if (
        !event.currentTarget
          .checkValidity()
      ) {

        event.currentTarget
          .reportValidity();


        return;

      }


      const terms =
        window.MC.$(
          '#terms'
        );


      if (
        !terms?.checked
      ) {

        window.MC.toast(
          'Please accept order confirmation.',
          'error'
        );


        return;

      }


      if (
        !validateCheckoutAddress()
      ) {

        return;

      }


      const method =
        document.querySelector(
          'input[name="paymentMethod"]:checked'
        )
          ?.value;


      if (
        method ===
        'COD'
      ) {

        await placeCodOrder();

        return;

      }


      if (
        method ===
        'RAZORPAY'
      ) {

        await placeOnlineOrder();

        return;

      }


      window.MC.toast(
        'Payment method select karein.',
        'error'
      );

    }
  );

}


/* =========================
   START
========================= */

initCheckout()
  .catch(
    error => {

      console.error(
        'Checkout init error:',
        error
      );


      const checkoutBox =
        window.MC.$(
          '#checkout'
        );


      if (checkoutBox) {

        checkoutBox.innerHTML = `

          <div class="empty">
            Checkout load nahi ho pa raha hai.
          </div>

        `;

      }


      window.MC.toast(
        error.message ||
        'Checkout load failed.',
        'error'
      );

    }
  );
