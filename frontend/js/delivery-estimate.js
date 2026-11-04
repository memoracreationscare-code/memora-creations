
/*
=========================================
 MEMORA CREATIONS
 SHIPROCKET DELIVERY ESTIMATE - VERSION 3

 - Actual courier availability
 - Trusted product weight from backend
 - Cart and Buy Now support
 - COD and Cashfree support
 - Saved address PIN detection
 - Order success panel preserved
 - No order or payment modifications
 - No invented delivery dates
=========================================
*/

(() => {
  'use strict';

  const MC = window.MC;

  const CHECK_INTERVAL = 350;
  const REQUEST_DELAY = 700;

  function validPin(value) {
    return /^[1-9][0-9]{5}$/.test(
      String(value || '').trim()
    );
  }

  function createPanel() {
    const panel = document.createElement(
      'section'
    );

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

    heading.textContent =
      'Estimated Delivery';

    const result = document.createElement('p');

    result.className =
      'mc-estimate-result';

    result.setAttribute(
      'aria-live',
      'polite'
    );

    const note = document.createElement(
      'small'
    );

    note.textContent =
      'Courier availability and delivery dates ' +
      'are estimates, not guarantees.';

    panel.append(
      heading,
      result,
      note
    );

    return panel;
  }

  function setMessage(panel, message) {
    const result = panel.querySelector(
      '.mc-estimate-result'
    );

    if (result) {
      result.textContent = message;
    }
  }

  function paymentMethod() {
    const selected =
      document.querySelector(
        'input[name="paymentMethod"]:checked'
      );

    return selected?.value === 'COD'
      ? 'COD'
      : 'PREPAID';
  }

  function getCheckoutItems() {
    const params = new URLSearchParams(
      location.search
    );

    const buyNow = params.get('buyNow');

    if (buyNow) {
      const quantity = Number(
        params.get('qty') || 1
      );

      return Promise.resolve([{
        productId: buyNow,
        quantity:
          Number.isInteger(quantity) &&
          quantity >= 1 &&
          quantity <= 99
            ? quantity
            : 1
      }]);
    }

    if (!MC?.api) {
      return Promise.reject(
        new Error('Checkout API is unavailable.')
      );
    }

    return MC.api('/cart').then(data => {
      return (data.cart?.items || [])
        .filter(item => item.product?._id)
        .map(item => ({
          productId: item.product._id,
          quantity: Number(item.quantity)
        }))
        .filter(item =>
          Number.isInteger(item.quantity) &&
          item.quantity >= 1 &&
          item.quantity <= 99
        );
    });
  }

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

        if (result.available === true) {
          setMessage(
            panel,
            'Delivery is available for PIN Code ' +
            pin +
            '. Estimated delivery date will be ' +
            'confirmed after courier selection.'
          );
        } else if (result.available === false) {
          setMessage(
            panel,
            'No matching courier is currently ' +
            'available for this PIN Code and ' +
            'payment method.'
          );
        } else {
          setMessage(
            panel,
            result.message ||
            'Delivery availability could not be verified.'
          );
        }

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

      if (!MC?.api) {
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

    // Detect asynchronous saved-address PIN.
    // Watch only during initial checkout load.
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

  async function initializeOrderSuccess() {
    const holder = document.getElementById(
      'orderSuccess'
    );

    const orderId = new URLSearchParams(
      location.search
    ).get('id');

    if (
      !holder ||
      !orderId ||
      !MC?.api
    ) {
      return;
    }

    try {
      const data = await MC.api(
        '/orders/' +
        encodeURIComponent(orderId)
      );

      const order = data.order;

      if (!order) {
        return;
      }

      const panel = createPanel();

      setMessage(
        panel,
        'Order placed. Delivery date will be ' +
        'confirmed after courier selection.'
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
