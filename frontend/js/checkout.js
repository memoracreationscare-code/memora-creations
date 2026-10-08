const CHECKOUT_BASE =
  '/memora-creations';


let checkoutItems = [];
let checkoutUser = null;
let checkoutFromCart = false;
let orderSubmitting = false;


/* =========================
   POPUP
========================= */

function showCheckoutSuccess({
  title,
  message,
  buttonText = 'View Order',
  onContinue
}) {

  document
    .querySelector(
      '#checkoutSuccessPopup'
    )
    ?.remove();


  const overlay =
    document.createElement(
      'div'
    );


  overlay.id =
    'checkoutSuccessPopup';


  overlay.style.cssText = `
    position:fixed;
    inset:0;
    z-index:9999;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:20px;
    background:rgba(24,15,10,.68);
    backdrop-filter:blur(6px);
  `;


  overlay.innerHTML = `

    <div
      style="
        width:min(430px,94vw);
        padding:34px 26px 26px;
        border-radius:26px;
        background:#fffaf6;
        border:1px solid #eadfd5;
        text-align:center;
        box-shadow:0 25px 70px rgba(0,0,0,.28);
      "
    >

      <div
        style="
          width:76px;
          height:76px;
          margin:0 auto 18px;
          border-radius:50%;
          display:flex;
          align-items:center;
          justify-content:center;
          background:#eaf8ef;
          color:#147a43;
          font-size:36px;
          font-weight:900;
        "
      >
        ✓
      </div>


      <h2
        style="
          margin:0 0 10px;
          color:#2b1b12;
          font-size:27px;
        "
      >
        ${window.MC.esc(title)}
      </h2>


      <p
        style="
          margin:0 auto 24px;
          max-width:340px;
          color:#756f69;
          font-size:14px;
          line-height:1.6;
        "
      >
        ${window.MC.esc(message)}
      </p>


      <button
        id="checkoutSuccessContinue"
        type="button"
        style="
          width:100%;
          min-height:52px;
          border:0;
          border-radius:999px;
          background:linear-gradient(180deg,#9b613c,#7e492a);
          color:#fff;
          font-size:15px;
          font-weight:900;
          cursor:pointer;
        "
      >
        ${window.MC.esc(buttonText)}
      </button>

    </div>

  `;


  document.body.appendChild(
    overlay
  );


  overlay
    .querySelector(
      '#checkoutSuccessContinue'
    )
    ?.addEventListener(
      'click',
      () => {

        overlay.remove();

        if (
          typeof onContinue ===
          'function'
        ) {

          onContinue();

        }

      }
    );

}


/* =========================
   VALIDATION
========================= */

function isValidCheckoutMobile(
  value
) {

  return /^[6-9][0-9]{9}$/
    .test(
      String(
        value || ''
      ).trim()
    );

}


function isValidCheckoutPin(
  value
) {

  return /^[0-9]{6}$/
    .test(
      String(
        value || ''
      ).trim()
    );

}


/* =========================
   ADDRESS
========================= */

function getCheckoutAddress() {

  return {

    fullName:
      window.MC.$('#fullName')
        ?.value.trim() || '',

    mobile:
      window.MC.$('#mobile')
        ?.value.trim() || '',

    addressLine:
      window.MC.$('#addressLine')
        ?.value.trim() || '',

    pinCode:
      window.MC.$('#pinCode')
        ?.value.trim() || '',

    city:
      window.MC.$('#city')
        ?.value.trim() || '',

    state:
      window.MC.$('#state')
        ?.value.trim() || ''

  };

}


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
   LOADING
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


  button.innerHTML =
    loading

      ? 'Please wait...'

      : 'Place Order / Pay <span>→</span>';

}


/* =========================
   RAZORPAY
========================= */

function loadRazorpayScript() {

  return new Promise(
    (resolve,reject) => {

      if (window.Razorpay) {

        resolve();
        return;

      }


      const existing =
        document.querySelector(
          'script[data-razorpay-checkout="true"]'
        );


      if (existing) {

        existing.addEventListener(
          'load',
          resolve,
          { once:true }
        );


        existing.addEventListener(
          'error',
          () => reject(
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


      script.dataset
        .razorpayCheckout =
        'true';


      script.onload =
        resolve;


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
   INIT
========================= */

async function initCheckout() {

  checkoutUser =
    await window.MC.requireLogin();


  if (!checkoutUser) {
    return;
  }


  const checkoutBox =
    window.MC.$('#checkout');


  const summaryBox =
    window.MC.$('#summary');


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
    params.get('buyNow');


  if (buyNowId) {

    checkoutFromCart =
      false;


    checkoutItems = [{

      productId:
        buyNowId,

      quantity:
        Math.max(
          1,
          Number(
            params.get('qty') ||
            1
          )
        )

    }];


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


  const preview =
    await window.MC.api(
      '/orders/preview',
      {

        method:'POST',

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

            <div class="summaryline">

              <span>

                ${window.MC.esc(
                  item.name ||
                  'Product'
                )}

                × ${Number(
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


    <div class="summaryline">

      <span>
        Delivery
      </span>

      <b>
        ${window.MC.money(
          preview.deliveryCharge
        )}
      </b>

    </div>


    <div class="summaryline">

      <span>
        You Save
      </span>

      <b>
        ${window.MC.money(
          preview.discount
        )}
      </b>

    </div>


    <div class="summaryline total">

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

    [
      'fullName',
      'mobile',
      'addressLine',
      'pinCode',
      'city',
      'state'
    ]
      .forEach(
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
      window.MC.$('#fullName');


    const mobileInput =
      window.MC.$('#mobile');


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
   COD
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


  setCheckoutLoading(true);


  try {

    const data =
      await window.MC.api(
        '/orders/cod',
        {

          method:'POST',

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


    showCheckoutSuccess({

      title:
        'Order Placed Successfully',

      message:
        'Thank you for shopping with Memora Creations. Your order has been confirmed.',

      buttonText:
        'Continue',

      onContinue:
        () => {

          location.href =
            CHECKOUT_BASE +
            '/frontend/order-success.html?id=' +
            encodeURIComponent(
              data.order._id
            );

        }

    });


  } catch (error) {

    orderSubmitting =
      false;


    setCheckoutLoading(false);


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


  setCheckoutLoading(true);


  try {

    const data =
      await window.MC.api(
        '/payment/create-order',
        {

          method:'POST',

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
          color:'#8a5a3b'
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

                    method:'POST',

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


              showCheckoutSuccess({

                title:
                  'Payment Successful',

                message:
                  'Your payment was successful and your order has been confirmed.',

                buttonText:
                  'Continue',

                onContinue:
                  () => {

                    location.href =
                      CHECKOUT_BASE +
                      '/frontend/order-success.html?id=' +
                      encodeURIComponent(
                        verified.order._id
                      );

                  }

              });


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

            method:'POST',

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
   SUBMIT
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


      if (!terms?.checked) {

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
