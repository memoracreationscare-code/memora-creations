
/*
=========================================
 MEMORA CREATIONS
 SHIPROCKET DELIVERY ESTIMATE - VERSION 4

 - Live Shiprocket Courier Availability
 - Verified Shiprocket Estimated Date
 - Cart and Buy Now support
 - COD and Cashfree support
 - Saved Address PIN auto-detection
 - Order Success panel
 - No changes to payments or orders
 - Never invent delivery dates
=========================================
*/

(() => {
  'use strict';

  const CHECK_INTERVAL = 350;
  const REQUEST_DELAY = 700;

  function validPin(value) {
    return /^[1-9][0-9]{5}$/.test(
      String(value || '').trim()
    );
  }

  function getMC() {
    return window.MC;
  }

  function createPanel() {
    const panel = document.createElement('section');

    panel.id = 'mcDeliveryEstimate';

    panel.style.cssText = [
      'margin:18px 0',
      'padding:18px',
      'border:1px solid #e7d8c8',
      'border-radius:14px',
      'background:#fffaf5',
      'color:#34251c'
    ].join(';');

    const heading = document.createElement('h3');
    heading.textContent = 'Estimated Delivery';

    const result = document.createElement('p');
    result.className = 'mc-estimate-result';
    result.setAttribute('aria-live', 'polite');

    const note = document.createElement('small');
    note.textContent =
      'Courier dates are estimates, not guarantees.';

    panel.append(heading, result, note);

    return panel;
  }

  function setMessage(panel, message) {
    const target = panel.querySelector(
      '.mc-estimate-result'
    );

    if (target) {
      target.textContent = message;
    }
  }

  /*
   =====================================
   VERIFIED DATE FORMAT

   Accept only YYYY-MM-DD returned
   by the trusted backend.
   =====================================
  */

  function formatDeliveryDate(value) {
    if (
      typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
      return null;
    }

    const parts = value.split('-').map(Number);

    const year = parts[0];
    const month = parts[1];
    const day = parts[2];

    const date = new Date(
      Date.UTC(year, month - 1, day)
    );

    if (
      !Number.isFinite(date.getTime()) ||
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }

    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(date);
  }

  /*
   =====================================
   PAYMENT METHOD
   =====================================
  */

  function paymentMethod() {
    const selected = document.querySelector(
      'input[name="paymentMethod"]:checked'
    );

    return selected?.value === 'COD'
      ? 'COD'
      : 'PREPAID';
  }

  /*
   =====================================
   CART / BUY NOW ITEMS
   =====================================
  */

  async function getCheckoutItems() {
    const params = new URLSearchParams(
      location.search
    );

    const buyNowId = params.get('buyNow');

    if (buyNowId) {
      const rawQty = Number(
        params.get('qty') || 1
      );

      const quantity =
        Number.isInteger(rawQty) &&
        rawQty >= 1 &&
        rawQty <= 99
          ? rawQty
          : 1;

      return [{
        productId: buyNowId,
        ...(params.get('variant')
          ? { variantId: params.get('variant') }
          : {}),
        quantity
      }];
    }

    const MC = getMC();

    if (!MC?.api) {
      throw new Error(
        'Delivery service is not ready.'
      );
    }

    const data = await MC.api('/cart');

    return (data.cart?.items || [])
      .filter(item => item.product?._id)
      .map(item => ({
        productId: item.product._id,
        ...(item.variantId ? { variantId: item.variantId } : {}),
        quantity: Number(item.quantity)
      }))
      .filter(item =>
        Number.isInteger(item.quantity) &&
        item.quantity >= 1 &&
        item.quantity <= 99
      );
  }

  /*
   =====================================
   FORMAT SHIPROCKET RESULT
   =====================================
  */

  function deliveryMessage(result, pin) {
    if (!result || result.success !== true) {
      return (
        result?.message ||
        'Delivery availability could not be verified.'
      );
    }

    if (result.available === false) {
      return (
        'No matching courier is currently ' +
        'available for this PIN Code and ' +
        'payment method.'
      );
    }

    if (result.available !== true) {
      return (
        'Delivery availability could not be verified.'
      );
    }

    const date = formatDeliveryDate(
      result.estimatedDeliveryDate
    );

    if (date) {
      return (
        'Estimated Delivery: ' +
        date +
        '. This is the earliest available ' +
        'Shiprocket courier estimate, ' +
        'not a guaranteed arrival date.'
      );
    }

    return (
      'Delivery is available for PIN Code ' +
      pin +
      '. Estimated delivery date will be ' +
      'confirmed after courier selection.'
    );
  }

  /*
   =====================================
   CHECKOUT DELIVERY ESTIMATE
   =====================================
  */

  function initializeCheckout() {
    const pinInput = document.getElementById(
      'pinCode'
    );

    const form = document.getElementById(
      'checkoutForm'
    );

    if (!pinInput || !form) {
      return;
    }

    let panel = document.getElementById(
      'mcDeliveryEstimate'
    );

    if (!panel) {
      panel = createPanel();

      pinInput.insertAdjacentElement(
        'afterend',
        panel
      );
    }

    let lastKey = '';
    let requestSequence = 0;
    let debounceTimer = null;

    async function checkDelivery(
      pin,
      method,
      sequence
    ) {
      try {
        const items = await getCheckoutItems();

        if (sequence !== requestSequence) {
          return;
        }

        if (!items.length) {
          setMessage(
            panel,
            'Add a product to check delivery.'
          );
          return;
        }

        const MC = getMC();

        if (!MC?.api) {
          throw new Error(
            'Delivery service is unavailable.'
          );
        }

        const result = await MC.api(
          '/delivery/check',
          {
            method: 'POST',
            body: JSON.stringify({
              pincode: pin,
              paymentMethod: method,
              items
            })
          }
        );

        if (sequence !== requestSequence) {
          return;
        }

        setMessage(
          panel,
          deliveryMessage(result, pin)
        );

      } catch (err) {
        if (sequence !== requestSequence) {
          return;
        }

        setMessage(
          panel,
          err.message ||
          'Delivery check is temporarily unavailable.'
        );
      }
    }

    function update(force = false) {
      const pin = String(
        pinInput.value || ''
      ).trim();

      const method = paymentMethod();

      const key = pin + ':' + method;

      if (!force && key === lastKey) {
        return;
      }

      lastKey = key;
      requestSequence += 1;

      const sequence = requestSequence;

      clearTimeout(debounceTimer);

      if (!validPin(pin)) {
        setMessage(
          panel,
          'Enter a valid 6-digit PIN Code.'
        );
        return;
      }

      if (!getMC()?.api) {
        setMessage(
          panel,
          'Delivery service is loading.'
        );
        return;
      }

      setMessage(
        panel,
        'Checking Shiprocket courier availability...'
      );

      debounceTimer = setTimeout(
        () => checkDelivery(
          pin,
          method,
          sequence
        ),
        REQUEST_DELAY
      );
    }

    pinInput.addEventListener(
      'input',
      () => update()
    );

    pinInput.addEventListener(
      'change',
      () => update()
    );

    document.querySelectorAll(
      'input[name="paymentMethod"]'
    ).forEach(input => {
      input.addEventListener(
        'change',
        () => update()
      );
    });

    window.addEventListener(
      'pageshow',
      () => update(true)
    );

    update(true);

    /*
      Detect saved-address PIN autofill.
      Stop watching after initial loading.
    */

    const startedAt = Date.now();

    const watcher = setInterval(() => {
      update();

      if (Date.now() - startedAt > 20000) {
        clearInterval(watcher);
      }
    }, CHECK_INTERVAL);

    window.addEventListener(
      'pagehide',
      () => {
        clearInterval(watcher);
        clearTimeout(debounceTimer);
        requestSequence += 1;
      },
      { once: true }
    );
  }

  /*
   =====================================
   ORDER SUCCESS DISPLAY

   No new courier check here:
   order may already have been placed.

   Do not pretend the courier is
   assigned or a date is confirmed.
   =====================================
  */

  async function initializeOrderSuccess() {
    const holder = document.getElementById(
      'orderSuccess'
    );

    const orderId = new URLSearchParams(
      location.search
    ).get('id');

    const MC = getMC();

    if (!holder || !orderId || !MC?.api) {
      return;
    }

    try {
      const data = await MC.api(
        '/orders/' +
        encodeURIComponent(orderId)
      );

      if (!data.order) {
        return;
      }

      const panel = createPanel();

      setMessage(
        panel,
        'Order placed. Your delivery date ' +
        'will be confirmed after courier selection.'
      );

      function insertPanel() {
        const card = holder.querySelector(
          '.success-card'
        );

        if (!card) {
          return false;
        }

        if (!document.getElementById(
          'mcDeliveryEstimate'
        )) {
          card.appendChild(panel);
        }

        return true;
      }

      if (insertPanel()) {
        return;
      }

      const observer = new MutationObserver(
        () => {
          if (insertPanel()) {
            observer.disconnect();
          }
        }
      );

      observer.observe(holder, {
        childList: true,
        subtree: true
      });

      setTimeout(
        () => observer.disconnect(),
        15000
      );

    } catch (err) {
      console.warn(
        'Delivery estimate unavailable:',
        err.message
      );
    }
  }

  /*
   =====================================
   INITIALIZATION
   =====================================
  */

  function initialize() {
    const path = location.pathname;

    if (path.endsWith('/checkout.html')) {
      initializeCheckout();
    }

    if (path.endsWith('/order-success.html')) {
      initializeOrderSuccess();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }
})();
