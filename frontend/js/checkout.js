
/*
 MEMORA CREATIONS
 Cashfree + COD Checkout
 Coupon Support
 WhatsApp Customer Consent
*/

(() => {
  'use strict';

  const BASE = '/memora-creations';
  const MC = window.MC;

  if (!MC) {
    console.error('app.js must load before checkout.js');
    return;
  }

  let items = [];
  let user = null;
  let fromCart = false;
  let submitting = false;

  // Existing coupon functionality
  let appliedCouponCode = null;
  let previewSequence = 0;

  const $ = selector => document.querySelector(selector);

  function message(text, type = 'error') {
    MC.toast(text, type);
  }

  function setLoading(value) {
    submitting = value;

    const button = $('#checkoutForm button[type="submit"]');

    if (button) {
      button.disabled = value;
      button.innerHTML = value
        ? 'Please wait...'
        : 'Place Order / Pay <span>→</span>';
    }
  }

  function addressData() {
    const value = id => ($(`#${id}`)?.value || '').trim();

    return {
      fullName: value('fullName'),
      mobile: value('mobile'),
      addressLine: value('addressLine'),
      pinCode: value('pinCode'),
      city: value('city'),
      state: value('state')
    };
  }

  function validateAddress() {
    const a = addressData();

    if (!a.fullName) {
      message('Full Name required hai.');
      return false;
    }

    if (!/^[6-9]\d{9}$/.test(a.mobile)) {
      message('Valid 10 digit mobile number dalo.');
      return false;
    }

    if (!a.addressLine) {
      message('Full address required hai.');
      return false;
    }

    if (!/^\d{6}$/.test(a.pinCode)) {
      message('Valid 6 digit PIN Code dalo.');
      return false;
    }

    return true;
  }

  function orderUrl(id) {
    return `${BASE}/frontend/order-success.html?id=${encodeURIComponent(id)}`;
  }

  function showConfirmation(title, description, orderId) {
    $('#checkoutSuccessPopup')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'checkoutSuccessPopup';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;' +
      'justify-content:center;padding:20px;background:rgba(24,15,10,.68)';

    const panel = document.createElement('div');
    panel.style.cssText =
      'width:min(430px,94vw);padding:32px 24px;border-radius:22px;' +
      'background:#fffaf6;text-align:center;color:#2b1b12';

    const heading = document.createElement('h2');
    heading.textContent = title;

    const detail = document.createElement('p');
    detail.textContent = description;

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'View Order';
    button.style.cssText =
      'cursor:pointer;width:100%;padding:15px;border:0;border-radius:30px;' +
      'background:#8a5a3b;color:white;font-weight:700';

    button.addEventListener('click', () => {
      location.href = orderUrl(orderId);
    });

    panel.append(heading, detail, button);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  function populateAddress() {
    const addresses =
      Array.isArray(user?.addresses) ? user.addresses : [];

    const saved =
      addresses.find(a => a.isDefault) ||
      addresses[0] ||
      {};

    for (const field of [
      'fullName',
      'mobile',
      'addressLine',
      'pinCode',
      'city',
      'state'
    ]) {
      const element = $(`#${field}`);

      if (element) {
        element.value =
          saved[field] || user?.[field] || '';
      }
    }
  }

  function drawSummary(preview) {
    const summary = $('#summary');

    if (!summary) return;

    summary.replaceChildren();

    const line = (label, amount, isTotal = false) => {
      const row = document.createElement('div');
      row.className =
        isTotal ? 'summaryline total' : 'summaryline';

      const left = document.createElement('span');
      left.textContent = label;

      const right = document.createElement('b');
      right.textContent = MC.money(amount);

      row.append(left, right);
      summary.appendChild(row);
    };

    for (const item of preview.items || []) {
      line(
        `${item.name || 'Product'} × ${Number(item.quantity || 1)}`,
        item.lineTotal
      );
    }

    line('Delivery', preview.deliveryCharge);
    line(
      'You Save',
      preview.productSavings ?? preview.discount ?? 0
    );

    if (Number(preview.couponDiscount || 0) > 0) {
      line(
        'Coupon Discount',
        -Number(preview.couponDiscount)
      );
    }

    line('Total', preview.grandTotal, true);
  }

  function chosenMethod() {
    return $('input[name="paymentMethod"]:checked')?.value || '';
  }

  function couponMessage(text, isError = false) {
    const element = $('#mcCouponMessage');

    if (element) {
      element.textContent = text;
      element.style.color =
        isError ? '#aa4438' : '#24734c';
    }
  }

  function updateCouponControls() {
    const area = $('#mcCouponArea');

    if (area) {
      area.hidden =
        !['COD', 'CASHFREE'].includes(chosenMethod());
    }

    const remove = $('#mcCouponRemove');

    if (remove) {
      remove.hidden = !appliedCouponCode;
    }

    const input = $('#mcCouponInput');

    if (input) {
      input.value =
        appliedCouponCode || input.value;
    }
  }

  async function refreshCouponPreview(code = null) {
    const seq = ++previewSequence;

    const data = await MC.api('/orders/preview', {
      method: 'POST',
      body: JSON.stringify({
        items,
        ...(code ? { couponCode: code } : {})
      })
    });

    if (seq === previewSequence) {
      drawSummary(data);
    }

    return data;
  }

  async function applyCoupon() {
    if (
      submitting ||
      !['COD', 'CASHFREE'].includes(chosenMethod())
    ) {
      return;
    }

    const code = String(
      $('#mcCouponInput')?.value || ''
    ).trim().toUpperCase();

    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
      couponMessage(
        'Valid coupon code enter karein.',
        true
      );
      return;
    }

    const apply = $('#mcCouponApply');

    if (apply) {
      apply.disabled = true;
    }

    couponMessage('Coupon check ho raha hai...');

    try {
      const data = await refreshCouponPreview(code);

      if (
        !data.couponApplied ||
        data.couponCode !== code
      ) {
        throw new Error(
          'Coupon verify nahi hua.'
        );
      }

      appliedCouponCode = code;

      couponMessage(
        'Coupon applied! Discount order summary me dikh raha hai.'
      );

      updateCouponControls();

    } catch (err) {
      couponMessage(
        err.message || 'Coupon invalid hai.',
        true
      );

    } finally {
      if (apply) {
        apply.disabled = false;
      }
    }
  }

  async function removeCoupon() {
    if (submitting) return;

    appliedCouponCode = null;

    const input = $('#mcCouponInput');

    if (input) {
      input.value = '';
    }

    couponMessage('Coupon removed.');
    updateCouponControls();

    try {
      await refreshCouponPreview();
    } catch (err) {
      couponMessage(
        err.message || 'Summary refresh nahi hua.',
        true
      );
    }
  }

  $('#mcCouponApply')?.addEventListener(
    'click',
    applyCoupon
  );

  $('#mcCouponRemove')?.addEventListener(
    'click',
    removeCoupon
  );

  $('#mcCouponInput')?.addEventListener(
    'keydown',
    event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        applyCoupon();
      }
    }
  );

  document.querySelectorAll(
    'input[name="paymentMethod"]'
  ).forEach(input => {
    input.addEventListener('change', async () => {
      updateCouponControls();

      if (appliedCouponCode) {
        try {
          await refreshCouponPreview(
            appliedCouponCode
          );
        } catch (err) {
          couponMessage(
            err.message || 'Coupon validate nahi hua.',
            true
          );
        }
      }
    });
  });

  async function initialize() {
    user = await MC.requireLogin();

    if (!user) return;

    const params = new URLSearchParams(
      location.search
    );

    const buyNowId = params.get('buyNow');

    if (buyNowId) {
      fromCart = false;

      const qty = Number(
        params.get('qty') || 1
      );

      items = [{
        productId: buyNowId,
        quantity: Number.isFinite(qty)
          ? Math.min(
              99,
              Math.max(1, Math.floor(qty))
            )
          : 1
      }];

    } else {
      fromCart = true;

      const cart = await MC.api('/cart');

      items = (cart.cart?.items || [])
        .filter(x => x.product?._id)
        .map(x => ({
          productId: x.product._id,
          quantity: Number(x.quantity) || 1
        }));
    }

    if (!items.length) {
      $('#checkout').innerHTML =
        '<div class="empty">Cart is empty.</div>';
      return;
    }

    await refreshCouponPreview();
    updateCouponControls();
    populateAddress();
  }

  /*
  ========================================
   WHATSAPP CUSTOMER OPT-IN

   This reads only the customer's
   actual checkbox selection.

   Disabled checkbox = false.
   Unchecked checkbox = false.
   Checked and enabled = true.

   Consent never defaults to true.
  ========================================
  */

  function whatsappConsentValue() {
    const checkbox = $('#whatsappOptIn');

    return Boolean(
      checkbox &&
      checkbox.disabled === false &&
      checkbox.checked === true
    );
  }

  /*
  ========================================
   SHARED ORDER REQUEST PAYLOAD

   Used by both COD and CASHFREE.
  ========================================
  */

  function payload() {
    return {
      items,
      address: addressData(),
      clearCart: fromCart,

      whatsappOptIn: whatsappConsentValue(),

      ...(appliedCouponCode &&
        ['COD', 'CASHFREE'].includes(chosenMethod())
          ? { couponCode: appliedCouponCode }
          : {})
    };
  }

  /*
  ========================================
   CASH ON DELIVERY
  ========================================
  */

  async function placeCodOrder() {
    setLoading(true);

    try {
      if (appliedCouponCode) {
        await refreshCouponPreview(
          appliedCouponCode
        );
      }

      const data = await MC.api('/orders/cod', {
        method: 'POST',
        body: JSON.stringify(payload())
      });

      if (!data.order?._id) {
        throw new Error(
          'Order bana, lekin order ID nahi mila.'
        );
      }

      showConfirmation(
        'Order Placed Successfully',
        'Aapka Cash on Delivery order confirm ho gaya hai.',
        data.order._id
      );

    } catch (err) {
      message(
        err.message || 'COD order place nahi hua.'
      );

    } finally {
      setLoading(false);
    }
  }

  /*
  ========================================
   CASHFREE ONLINE PAYMENT
  ========================================
  */

  async function placeCashfreeOrder() {
    setLoading(true);

    let orderId = null;

    try {
      if (appliedCouponCode) {
        await refreshCouponPreview(
          appliedCouponCode
        );
      }

      if (
        typeof window.Cashfree !== 'function'
      ) {
        throw new Error(
          'Cashfree SDK load nahi hua. Page refresh karein.'
        );
      }

      const created = await MC.api(
        '/cashfree/create-order',
        {
          method: 'POST',
          body: JSON.stringify(payload())
        }
      );

      orderId = created.orderId;

      if (
        !created.paymentSessionId ||
        !orderId
      ) {
        throw new Error(
          'Cashfree payment session nahi mila.'
        );
      }

      const cashfree = window.Cashfree({
        mode:
          created.mode === 'production'
            ? 'production'
            : 'sandbox'
      });

      // SDK completion alone is not proof
      // that the payment was successful.

      const result = await cashfree.checkout({
        paymentSessionId:
          created.paymentSessionId,
        redirectTarget: '_modal'
      });

      if (result?.redirect) {
        message(
          'Payment redirect ho raha hai. Order status check karein.',
          'message'
        );
        return;
      }

      /*
        Verify payment with the server.
        Never trust the browser alone.
      */

      const verified = await MC.api(
        '/cashfree/verify',
        {
          method: 'POST',
          body: JSON.stringify({
            orderId
          })
        }
      );

      if (
        verified.verified === true &&
        verified.paymentStatus === 'SUCCESS' &&
        verified.order?._id
      ) {
        showConfirmation(
          'Payment Successful',
          'Cashfree ne payment confirm kar diya hai.',
          verified.order._id
        );

        return;
      }

      message(
        result?.error?.message ||
        'Payment abhi confirm nahi hua. My Orders me status dekhein.',
        'message'
      );

    } catch (err) {

      // Verification errors do not prove
      // that payment has failed.

      message(
        orderId
          ? 'Payment confirm nahi ho paya. Dubara pay karne se pehle My Orders check karein.'
          : (
              err.message ||
              'Online payment start nahi hua.'
            )
      );

    } finally {
      setLoading(false);
    }
  }

  /*
  ========================================
   CHECKOUT FORM
  ========================================
  */

  const form = $('#checkoutForm');

  if (form) {
    form.addEventListener(
      'submit',
      async event => {
        event.preventDefault();

        if (submitting) return;

        if (!form.checkValidity()) {
          form.reportValidity();
          return;
        }

        if (!$('#terms')?.checked) {
          message(
            'Please accept order confirmation.'
          );
          return;
        }

        if (!validateAddress()) {
          return;
        }

        const method = $(
          'input[name="paymentMethod"]:checked'
        )?.value;

        if (method === 'COD') {
          await placeCodOrder();

        } else if (method === 'CASHFREE') {
          await placeCashfreeOrder();

        } else {
          message(
            'Payment method select karein.'
          );
        }
      }
    );
  }

  /*
  ========================================
   INITIALIZE
  ========================================
  */

  initialize().catch(err => {
    console.error(
      'Checkout initialization failed:',
      err
    );

    const summary = $('#summary');

    if (summary) {
      summary.textContent =
        'Checkout load nahi hua. Page refresh karein.';
    }

    const submit = $(
      '#checkoutForm button[type="submit"]'
    );

    if (submit) {
      submit.disabled = true;
    }

    message(
      err.message || 'Checkout load nahi hua.'
    );
  });

})();
