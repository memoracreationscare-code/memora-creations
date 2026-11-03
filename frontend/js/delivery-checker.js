
'use strict';

/*
=========================================
 MEMORA CREATIONS
 DELIVERY CHECKER V2

 - Works on Product Details Page
 - Works inside Product Quick View Popup
 - PREPAID / COD availability
 - Uses existing Shiprocket-backed API
 - No fake availability claims
 - Does not change checkout or payments
=========================================
*/

(() => {

  const STYLE_ID = 'mcDeliveryCheckerStyles';

  const SELECTOR = '.mc-delivery-checker';

  const make = (tag, className, text) => {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text !== undefined) {
      element.textContent = String(text);
    }

    return element;
  };


  /* =====================================
     STYLES
  ===================================== */

  function installStyles() {

    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = make('style');

    style.id = STYLE_ID;

    style.textContent = `
      .mc-delivery-checker {
        margin: 18px 0;
        padding: 19px;
        border: 1px solid #e8d8ca;
        border-radius: 16px;
        background: #fffaf5;
        color: #302117;
        box-sizing: border-box;
        width: 100%;
      }

      .mc-delivery-title {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 15px;
      }

      .mc-delivery-symbol {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 42px;
        height: 42px;
        flex-shrink: 0;
        background: #f5e5d6;
        border-radius: 12px;
        font-size: 23px;
      }

      .mc-delivery-title strong {
        display: block;
        color: #302117;
        font-size: 15px;
      }

      .mc-delivery-title small {
        display: block;
        color: #817367;
        margin-top: 4px;
        font-size: 11px;
        line-height: 1.5;
      }

      .mc-delivery-form {
        display: flex;
        flex-wrap: wrap;
        align-items: stretch;
        gap: 9px;
      }

      .mc-delivery-pin {
        flex: 1 1 120px;
        min-width: 0;
        padding: 12px;
        border: 1px solid #dccbbb;
        border-radius: 10px;
        background: #fff;
        color: #302117;
        font: inherit;
        font-size: 13px;
      }

      .mc-delivery-mode {
        padding: 12px;
        border: 1px solid #dccbbb;
        border-radius: 10px;
        background: #fff;
        color: #302117;
        font: inherit;
        font-size: 12px;
      }

      .mc-delivery-check {
        padding: 12px 17px;
        border: 0;
        border-radius: 10px;
        background: #8b5b3a;
        color: white;
        font-weight: 800;
        cursor: pointer;
      }

      .mc-delivery-check:disabled {
        opacity: .6;
        cursor: wait;
      }

      .mc-delivery-result {
        margin-top: 12px;
        padding: 12px;
        border-radius: 10px;
        line-height: 1.6;
        font-size: 12px;
        overflow-wrap: anywhere;
      }

      .mc-delivery-result[hidden] {
        display: none;
      }

      .mc-delivery-result.success {
        background: #e8f7ec;
        border: 1px solid #b8e2c2;
        color: #166534;
      }

      .mc-delivery-result.unavailable {
        background: #fff2e5;
        border: 1px solid #edcbab;
        color: #98561b;
      }

      .mc-delivery-result.error {
        background: #fff0f0;
        border: 1px solid #edbbbb;
        color: #ad2929;
      }

      .mc-delivery-note {
        margin: 11px 0 0;
        color: #8b796c;
        font-size: 10px;
        line-height: 1.6;
      }

      .product-popup .mc-delivery-checker {
        margin: 14px 0;
      }

      @media (max-width: 560px) {
        .mc-delivery-checker {
          padding: 14px;
        }

        .mc-delivery-form {
          display: grid;
          grid-template-columns: 1fr 1fr;
        }

        .mc-delivery-pin {
          grid-column: 1 / -1;
        }

        .mc-delivery-mode,
        .mc-delivery-check {
          width: 100%;
        }
      }
    `;

    document.head.appendChild(style);
  }


  /* =====================================
     RESULT
  ===================================== */

  function showResult(box, message, type) {

    box.hidden = false;

    box.className =
      'mc-delivery-result ' + type;

    box.textContent = message;
  }


  /* =====================================
     API CALL
  ===================================== */

  async function verifyDelivery(
    pincode,
    method,
    result,
    button
  ) {

    if (!/^[1-9][0-9]{5}$/.test(pincode)) {

      showResult(
        result,
        'Please enter a valid 6-digit Indian PIN code.',
        'error'
      );

      return;
    }

    if (!['PREPAID', 'COD'].includes(method)) {

      showResult(
        result,
        'Please select a valid delivery payment mode.',
        'error'
      );

      return;
    }

    if (
      !window.MC ||
      typeof window.MC.api !== 'function'
    ) {

      showResult(
        result,
        'Delivery service is unavailable.',
        'error'
      );

      return;
    }

    button.disabled = true;
    button.textContent = 'Checking...';
    result.hidden = true;

    try {

      const path =
        '/delivery/check?pincode=' +
        encodeURIComponent(pincode) +
        '&paymentMethod=' +
        encodeURIComponent(method);

      const data = await window.MC.api(path);

      if (
        data.success === true &&
        data.available === true
      ) {

        showResult(
          result,
          '✓ Courier service is currently available ' +
          'for PIN ' + pincode + ' (' +
          (method === 'COD'
            ? 'Cash on Delivery'
            : 'Prepaid') +
          '). Final availability depends on ' +
          'parcel details.',
          'success'
        );

      } else if (
        data.success === true &&
        data.available === false
      ) {

        showResult(
          result,
          'No matching courier is currently available ' +
          'for this PIN code and payment mode.',
          'unavailable'
        );

      } else {

        showResult(
          result,
          'Delivery availability could not be verified.',
          'error'
        );

      }

    } catch (error) {

      console.error(
        'Delivery check failed:',
        error
      );

      showResult(
        result,
        'Delivery availability could not be checked. ' +
        'Please try again later.',
        'error'
      );

    } finally {

      button.disabled = false;
      button.textContent = 'Check';

    }
  }


  /* =====================================
     CREATE WIDGET
  ===================================== */

  function buildChecker() {

    const root = make(
      'section',
      'mc-delivery-checker'
    );

    const heading = make(
      'div',
      'mc-delivery-title'
    );

    const symbol = make(
      'span',
      'mc-delivery-symbol',
      '🚚'
    );

    const title = make('div');

    title.append(
      make(
        'strong',
        null,
        'Check Delivery Availability'
      ),
      make(
        'small',
        null,
        'Check delivery to your PIN code'
      )
    );

    heading.append(symbol, title);

    const form = make(
      'form',
      'mc-delivery-form'
    );

    const pin = make(
      'input',
      'mc-delivery-pin'
    );

    pin.type = 'text';
    pin.inputMode = 'numeric';
    pin.maxLength = 6;
    pin.placeholder = '6-digit PIN code';
    pin.autocomplete = 'postal-code';
    pin.required = true;

    pin.setAttribute(
      'aria-label',
      'PIN code'
    );

    pin.addEventListener('input', () => {
      pin.value = pin.value
        .replace(/\D/g, '')
        .slice(0, 6);
    });

    const mode = make(
      'select',
      'mc-delivery-mode'
    );

    mode.setAttribute(
      'aria-label',
      'Payment mode'
    );

    const prepaid = make(
      'option',
      null,
      'Prepaid'
    );

    prepaid.value = 'PREPAID';

    const cod = make(
      'option',
      null,
      'Cash on Delivery'
    );

    cod.value = 'COD';

    mode.append(prepaid, cod);

    const button = make(
      'button',
      'mc-delivery-check',
      'Check'
    );

    button.type = 'submit';

    const result = make(
      'div',
      'mc-delivery-result'
    );

    result.hidden = true;

    result.setAttribute(
      'role',
      'status'
    );

    result.setAttribute(
      'aria-live',
      'polite'
    );

    form.addEventListener(
      'submit',
      async event => {

        event.preventDefault();

        await verifyDelivery(
          pin.value.trim(),
          mode.value,
          result,
          button
        );

      }
    );

    form.append(pin, mode, button);

    const note = make(
      'p',
      'mc-delivery-note',
      'Courier availability is informational. ' +
      'Actual dispatch depends on parcel ' +
      'weight, address and courier capacity.'
    );

    root.append(
      heading,
      form,
      result,
      note
    );

    return root;
  }


  /* =====================================
     SINGLE PRODUCT PAGE
  ===================================== */

  function mountProductPage() {

    const product = document.getElementById(
      'product'
    );

    if (!product) {
      return;
    }

    const next = product.nextElementSibling;

    if (
      next &&
      next.matches(SELECTOR)
    ) {
      return;
    }

    product.after(buildChecker());
  }


  /* =====================================
     QUICK VIEW POPUP
  ===================================== */

  function mountPopups() {

    document.querySelectorAll(
      '.product-popup'
    ).forEach(popup => {

      if (popup.querySelector(SELECTOR)) {
        return;
      }

      const info = popup.querySelector(
        '.product-popup-info'
      );

      if (!info) {
        return;
      }

      const actions = info.querySelector(
        '.product-popup-actions'
      );

      const checker = buildChecker();

      if (actions) {
        actions.before(checker);
      } else {
        info.appendChild(checker);
      }

    });
  }


  /* =====================================
     INITIALIZATION
  ===================================== */

  function initialize() {

    installStyles();

    mountProductPage();
    mountPopups();

    /*
      Product cards open a dynamically
      generated Quick View Popup.

      Watch for new popup elements.
    */

    const observer = new MutationObserver(
      () => {
        mountPopups();
      }
    );

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
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
