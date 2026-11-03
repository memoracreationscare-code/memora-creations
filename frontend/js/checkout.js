
/*
=========================================
 MEMORA CREATIONS
 CHECKOUT

 COD + CASHFREE
 COUPONS
 WHATSAPP CONSENT
 LIVE GIFT WRAPPING

 Normal   : Free
 Standard : INR 29
 Premium  : INR 59

 IMPORTANT:
 Gift availability and prices come
 from the backend, not the browser.
=========================================
*/

(() => {
  'use strict';

  const BASE = '/memora-creations';
  const MC = window.MC;

  if (!MC) {
    console.error('app.js must load before checkout.js');
    return;
  }

  const $ = selector =>
    document.querySelector(selector);

  const giftInputs = () =>
    Array.from(document.querySelectorAll(
      'input[name="mcGiftWrappingPreview"]'
    ));

  let items = [];
  let user = null;
  let fromCart = false;
  let submitting = false;

  let appliedCouponCode = null;
  let previewSequence = 0;

  let giftEnabled = false;
  let giftConfigReceived = false;

  const giftPrices = {
    NONE: 0,
    STANDARD: 29,
    PREMIUM: 59
  };

  function message(text, type = 'error') {
    MC.toast(text, type);
  }

  function setLoading(value) {
    submitting = value;

    const button = $(
      '#checkoutForm button[type="submit"]'
    );

    if (button) {
      button.disabled = value;

      button.innerHTML = value
        ? 'Please wait...'
        : 'Place Order / Pay <span>→</span>';
    }
  }

  /*
  ========================================
   ADDRESS
  ========================================
  */

  function addressData() {
    const value = id =>
      ($(`#${id}`)?.value || '').trim();

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
      message(
        'Valid 10 digit mobile number dalo.'
      );
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

  /*
  ========================================
   SUCCESS POPUP
  ========================================
  */

  function orderUrl(id) {
    return (
      `${BASE}/frontend/order-success.html?id=` +
      encodeURIComponent(id)
    );
  }

  function showConfirmation(
    title,
    description,
    orderId
  ) {
    $('#checkoutSuccessPopup')?.remove();

    const overlay =
      document.createElement('div');

    overlay.id = 'checkoutSuccessPopup';

    overlay.style.cssText =
      'position:fixed;inset:0;z-index:9999;' +
      'display:flex;align-items:center;' +
      'justify-content:center;padding:20px;' +
      'background:rgba(24,15,10,.68)';

    const panel =
      document.createElement('div');

    panel.style.cssText =
      'width:min(430px,94vw);padding:32px 24px;' +
      'border-radius:22px;background:#fffaf6;' +
      'text-align:center;color:#2b1b12';

    const heading =
      document.createElement('h2');

    heading.textContent = title;

    const detail =
      document.createElement('p');

    detail.textContent = description;

    const button =
      document.createElement('button');

    button.type = 'button';
    button.textContent = 'View Order';

    button.style.cssText =
      'cursor:pointer;width:100%;padding:15px;' +
      'border:0;border-radius:30px;' +
      'background:#8a5a3b;color:white;' +
      'font-weight:700';

    button.addEventListener(
      'click',
      () => {
        location.href = orderUrl(orderId);
      }
    );

    panel.append(heading, detail, button);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  /*
  ========================================
   SAVED ADDRESS
  ========================================
  */

  function populateAddress() {
    const addresses =
      Array.isArray(user?.addresses)
        ? user.addresses
        : [];

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
          saved[field] ||
          user?.[field] ||
          '';
      }
    }
  }

  /*
  ========================================
   GIFT WRAPPING

   Disabled by default.

   Only a trusted backend preview can
   unlock the paid wrapping options.
  ========================================
  */

  function defaultGift() {
    return {
      selected: false,
      type: 'NONE',
      message: ''
    };
  }

  function checkedGiftType() {
    const selected = $(
      'input[name="mcGiftWrappingPreview"]:checked'
    );

    return String(
      selected?.value || 'NONE'
    ).trim().toUpperCase();
  }

  function giftWrappingData() {
    if (!giftEnabled) {
      return defaultGift();
    }

    const selected = $(
      'input[name="mcGiftWrappingPreview"]:checked'
    );

    if (!selected || selected.disabled) {
      return defaultGift();
    }

    const type = checkedGiftType();

    if (type === 'NONE') {
      return defaultGift();
    }

    if (
      !['STANDARD', 'PREMIUM'].includes(type)
    ) {
      return defaultGift();
    }

    const input =
      $('#mcGiftMessagePreview');

    const giftMessage =
      input && !input.disabled
        ? input.value.trim()
        : '';

    return {
      selected: true,
      type,
      message: giftMessage.slice(0, 180)
    };
  }

  function syncGiftUI() {
    const inputs = giftInputs();
    const messageInput =
      $('#mcGiftMessagePreview');

    const section = $('#mcGiftWrap');

    const normal = inputs.find(
      x => x.value === 'NONE'
    );

    if (!giftEnabled) {
      for (const input of inputs) {
        input.disabled = true;
        input.checked = false;
      }

      if (normal) {
        normal.checked = true;
      }

      if (messageInput) {
        messageInput.value = '';
        messageInput.disabled = true;
      }

      if (section) {
        section.dataset.giftEnabled = 'false';
      }

    } else {
      for (const input of inputs) {
        input.disabled = ![
          'NONE',
          'STANDARD',
          'PREMIUM'
        ].includes(input.value);
      }

      if (!inputs.some(x => x.checked)) {
        if (normal) {
          normal.checked = true;
        }
      }

      const hasGift = [
        'STANDARD',
        'PREMIUM'
      ].includes(checkedGiftType());

      if (messageInput) {
        messageInput.disabled = !hasGift;

        if (!hasGift) {
          messageInput.value = '';
        }
      }

      if (section) {
        section.dataset.giftEnabled = 'true';
      }
    }

    const note = $(
      '#mcGiftWrap .mc-gift-wrap-note'
    );

    if (note) {
      note.textContent = giftEnabled
        ? (
            'Select Standard or Premium Gift ' +
            'Wrapping to add it to your order. ' +
            'The final fee is calculated securely ' +
            'by Memora Creations.'
          )
        : (
            'Gift wrapping is currently unavailable ' +
            'for purchase. Normal packaging is free, ' +
            'with no extra charge.'
          );
    }

    const badge = $(
      '#mcGiftWrap .mc-gift-wrap-test'
    );

    if (badge) {
      badge.textContent = giftEnabled
        ? 'Gift Wrapping Available'
        : 'Gift Wrapping — Coming Soon';
    }

    /*
      Remove muted styling only for
      currently selectable options.
    */

    for (const input of inputs) {
      const label = input.closest('label');

      if (label) {
        label.classList.toggle(
          'mc-gift-wrap-muted',
          input.disabled
        );
      }
    }
  }

  function applyGiftConfig(config) {
    /*
      Do not trust an absent or malformed
      configuration as enabled.
    */

    if (
      !config ||
      typeof config !== 'object' ||
      typeof config.enabled !== 'boolean'
    ) {
      giftEnabled = false;
      giftConfigReceived = false;
      syncGiftUI();
      return;
    }

    const prices = config.prices || {};

    const priceMatches =
      Number(prices.NONE) === 0 &&
      Number(prices.STANDARD) === 29 &&
      Number(prices.PREMIUM) === 59;

    /*
      If frontend and backend prices
      disagree, keep wrapping disabled.
    */

    giftEnabled =
      config.enabled === true &&
      priceMatches;

    giftConfigReceived = true;

    Object.assign(giftPrices, {
      NONE: 0,
      STANDARD: priceMatches
        ? Number(prices.STANDARD)
        : 29,
      PREMIUM: priceMatches
        ? Number(prices.PREMIUM)
        : 59
    });

    syncGiftUI();
  }

  function setGiftOption(type) {
    const input = giftInputs().find(
      x => x.value === type
    );

    if (input) {
      input.checked = true;
    }
  }

  /*
  ========================================
   ORDER SUMMARY
  ========================================
  */

  function drawSummary(preview) {
    const summary = $('#summary');

    if (!summary) return;

    summary.replaceChildren();

    const line = (
      label,
      amount,
      isTotal = false
    ) => {
      const row =
        document.createElement('div');

      row.className = isTotal
        ? 'summaryline total'
        : 'summaryline';

      const left =
        document.createElement('span');

      left.textContent = label;

      const right =
        document.createElement('b');

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

    line(
      'Delivery',
      preview.deliveryCharge
    );

    line(
      'You Save',
      preview.productSavings ??
      preview.discount ??
      0
    );

    if (
      Number(preview.couponDiscount || 0) > 0
    ) {
      line(
        'Coupon Discount',
        -Number(preview.couponDiscount)
      );
    }

    if (
      Number(preview.giftWrappingFee || 0) > 0
    ) {
      line(
        'Gift Wrapping',
        preview.giftWrappingFee
      );
    }

    line(
      'Total',
      preview.grandTotal,
      true
    );
  }

  /*
  ========================================
   PAYMENT METHOD + COUPONS
  ========================================
  */

  function chosenMethod() {
    return $(
      'input[name="paymentMethod"]:checked'
    )?.value || '';
  }

  function couponMessage(
    text,
    isError = false
  ) {
    const element = $('#mcCouponMessage');

    if (element) {
      element.textContent = text;

      element.style.color =
        isError
          ? '#aa4438'
          : '#24734c';
    }
  }

  function updateCouponControls() {
    const area = $('#mcCouponArea');

    if (area) {
      area.hidden = ![
        'COD',
        'CASHFREE'
      ].includes(chosenMethod());
    }

    const remove = $('#mcCouponRemove');

    if (remove) {
      remove.hidden = !appliedCouponCode;
    }

    const input = $('#mcCouponInput');

    if (input && appliedCouponCode) {
      input.value = appliedCouponCode;
    }
  }

  /*
  ========================================
   TRUSTED ORDER PREVIEW

   Only current response updates UI.
  ========================================
  */

  async function refreshCouponPreview(
    code = null
  ) {
    const seq = ++previewSequence;

    const selection = giftWrappingData();

    const data = await MC.api(
      '/orders/preview',
      {
        method: 'POST',
        body: JSON.stringify({
          items,
          giftWrapping: selection,

          ...(code
            ? { couponCode: code }
            : {})
        })
      }
    );

    if (seq === previewSequence) {
      /*
        Apply config only when there
        is a latest valid server result.
      */

      const previousSelection =
        selection.type;

      applyGiftConfig(
        data.giftWrappingConfig
      );

      if (
        giftEnabled &&
        previousSelection !== 'NONE'
      ) {
        setGiftOption(previousSelection);
        syncGiftUI();
      }

      drawSummary(data);
    }

    return data;
  }

  /*
  ========================================
   APPLY COUPON
  ========================================
  */

  async function applyCoupon() {
    if (
      submitting ||
      ![
        'COD',
        'CASHFREE'
      ].includes(chosenMethod())
    ) {
      return;
    }

    const code = String(
      $('#mcCouponInput')?.value || ''
    ).trim().toUpperCase();

    if (
      !/^[A-Z0-9_-]{3,30}$/.test(code)
    ) {
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

    couponMessage(
      'Coupon check ho raha hai...'
    );

    try {
      const data =
        await refreshCouponPreview(code);

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
        err.message ||
        'Coupon invalid hai.',
        true
      );

    } finally {
      if (apply) {
        apply.disabled = false;
      }
    }
  }

  /*
  ========================================
   REMOVE COUPON
  ========================================
  */

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
        err.message ||
        'Summary refresh nahi hua.',
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
    input.addEventListener(
      'change',
      async () => {
        updateCouponControls();

        try {
          await refreshCouponPreview(
            appliedCouponCode
          );
        } catch (err) {
          message(
            err.message ||
            'Summary update nahi hua.'
          );
        }
      }
    );
  });

  /*
  ========================================
   GIFT OPTION CHANGES
  ========================================
  */

  giftInputs().forEach(input => {
    input.addEventListener(
      'change',
      async () => {

        if (
          submitting ||
          !giftEnabled ||
          input.disabled
        ) {
          return;
        }

        const requestedType =
          checkedGiftType();

        syncGiftUI();

        try {
          await refreshCouponPreview(
            appliedCouponCode
          );
        } catch (err) {
          /*
            Roll back rejected gift choice.
            Never submit an unvalidated fee.
          */

          giftEnabled = false;
          giftConfigReceived = false;
          syncGiftUI();

          message(
            err.message ||
            `Gift option ${requestedType} verify nahi hua.`
          );

          try {
            await refreshCouponPreview(
              appliedCouponCode
            );
          } catch (_) {
            // Keep gift wrapping disabled.
          }
        }
      }
    );
  });

  $('#mcGiftMessagePreview')?.addEventListener(
    'change',
    async event => {
      if (
        submitting ||
        !giftEnabled ||
        event.currentTarget.disabled
      ) {
        return;
      }

      try {
        await refreshCouponPreview(
          appliedCouponCode
        );
      } catch (err) {
        message(
          err.message ||
          'Gift message verify nahi hua.'
        );
      }
    }
  );

  /*
  ========================================
   INITIALIZE CHECKOUT
  ========================================
  */

  async function initialize() {
    syncGiftUI();

    user = await MC.requireLogin();

    if (!user) return;

    const params =
      new URLSearchParams(
        location.search
      );

    const buyNowId =
      params.get('buyNow');

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
              Math.max(
                1,
                Math.floor(qty)
              )
            )
          : 1
      }];

    } else {
      fromCart = true;

      const cart =
        await MC.api('/cart');

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
   WHATSAPP OPT-IN

   Only explicit enabled checkbox
   means customer consent.
  ========================================
  */

  function whatsappConsentValue() {
    const checkbox =
      $('#whatsappOptIn');

    return Boolean(
      checkbox &&
      checkbox.disabled === false &&
      checkbox.checked === true
    );
  }

  /*
  ========================================
   SHARED ORDER PAYLOAD
  ========================================
  */

  function payload() {
    return {
      items,
      address: addressData(),

      clearCart: fromCart,

      whatsappOptIn:
        whatsappConsentValue(),

      giftWrapping:
        giftWrappingData(),

      ...(appliedCouponCode &&
        [
          'COD',
          'CASHFREE'
        ].includes(chosenMethod())
          ? {
              couponCode:
                appliedCouponCode
            }
          : {})
    };
  }

  /*
  ========================================
   VALIDATE CURRENT ORDER TOTAL

   Before checkout, request a fresh
   server preview for the selected
   wrapping option and coupon.
  ========================================
  */

  async function verifyBeforePayment() {
    const currentGift =
      giftWrappingData();

    const data =
      await refreshCouponPreview(
        appliedCouponCode
      );

    if (
      !giftConfigReceived ||
      !data.giftWrappingConfig
    ) {
      throw new Error(
        'Checkout configuration unavailable. Please refresh.'
      );
    }

    /*
      Do not continue if wrapping changed
      while the preview was being refreshed.
    */

    const confirmedGift =
      giftWrappingData();

    if (
      currentGift.type !==
      confirmedGift.type ||
      currentGift.message !==
      confirmedGift.message
    ) {
      throw new Error(
        'Gift wrapping selection changed. Please review your order.'
      );
    }

    if (
      !Number.isFinite(
        Number(data.grandTotal)
      ) ||
      Number(data.grandTotal) < 0
    ) {
      throw new Error(
        'Order total is invalid.'
      );
    }

    if (
      appliedCouponCode &&
      (
        data.couponApplied !== true ||
        data.couponCode !==
          appliedCouponCode
      )
    ) {
      throw new Error(
        'Coupon changed. Please check again.'
      );
    }

    return data;
  }

  /*
  ========================================
   CASH ON DELIVERY
  ========================================
  */

  async function placeCodOrder() {
    setLoading(true);

    try {
      await verifyBeforePayment();

      const data = await MC.api(
        '/orders/cod',
        {
          method: 'POST',
          body: JSON.stringify(
            payload()
          )
        }
      );

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
        err.message ||
        'COD order place nahi hua.'
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
      await verifyBeforePayment();

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
          body: JSON.stringify(
            payload()
          )
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

      const cashfree =
        window.Cashfree({
          mode:
            created.mode === 'production'
              ? 'production'
              : 'sandbox'
        });

      /*
        SDK completion alone does not
        prove the payment succeeded.
      */

      const result =
        await cashfree.checkout({
          paymentSessionId:
            created.paymentSessionId,

          redirectTarget:
            '_modal'
        });

      if (result?.redirect) {
        message(
          'Payment redirect ho raha hai. Order status check karein.',
          'message'
        );
        return;
      }

      /*
        Server verifies the payment.
      */

      const verified =
        await MC.api(
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
        verified.paymentStatus ===
          'SUCCESS' &&
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
      /*
        Payment verification errors
        do not prove payment failure.
      */

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

  const form =
    $('#checkoutForm');

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

        const method =
          chosenMethod();

        if (method === 'COD') {
          await placeCodOrder();

        } else if (
          method === 'CASHFREE'
        ) {
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
   START CHECKOUT
  ========================================
  */

  initialize().catch(err => {
    console.error(
      'Checkout initialization failed:',
      err
    );

    giftEnabled = false;
    syncGiftUI();

    const summary =
      $('#summary');

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
      err.message ||
      'Checkout load nahi hua.'
    );
  });

})();
