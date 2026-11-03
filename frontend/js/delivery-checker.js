
'use strict';

/*
=========================================
 MEMORA CREATIONS
 CUSTOMER PINCODE DELIVERY CHECKER V1

 Existing Backend:
 GET /api/delivery/check

 Features:
 - Indian PIN validation
 - Prepaid and COD checker
 - Live courier availability
 - Safe unavailable/error states
 - No guessed delivery promises
 - Read-only: no order/payment changes
=========================================
*/

(() => {

  const STYLE_ID = 'mc-delivery-checker-css';
  const ROOT_ID = 'mcDeliveryChecker';

  function make(tag, className, content) {
    const node = document.createElement(tag);

    if (className) {
      node.className = className;
    }

    if (content !== undefined) {
      node.textContent = String(content);
    }

    return node;
  }

  function addStyles() {

    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = make('style');

    style.id = STYLE_ID;

    style.textContent = `
      .mc-delivery-checker {
        margin: 22px 0;
        padding: 22px;
        border: 1px solid #e7d7c8;
        border-radius: 17px;
        background: #fffaf5;
        color: #302117;
        box-shadow: 0 8px 28px rgba(40,25,12,.04);
      }

      .mc-delivery-heading {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
      }

      .mc-delivery-icon {
        display: grid;
        place-items: center;
        width: 46px;
        height: 46px;
        flex-shrink: 0;
        border-radius: 13px;
        background: #f4e4d3;
        font-size: 24px;
      }

      .mc-delivery-heading strong {
        display: block;
        font-size: 16px;
      }

      .mc-delivery-heading small {
        display: block;
        margin-top: 5px;
        color: #85776b;
        line-height: 1.5;
      }

      .mc-delivery-form {
        display: flex;
        gap: 10px;
        align-items: stretch;
        flex-wrap: wrap;
      }

      .mc-delivery-pin {
        flex: 1 1 140px;
        min-width: 0;
        padding: 12px 14px;
        border: 1px solid #d9c9b9;
        background: white;
        border-radius: 11px;
        font: inherit;
        letter-spacing: 1px;
      }

      .mc-delivery-mode {
        padding: 12px;
        border: 1px solid #d9c9b9;
        border-radius: 11px;
        background: white;
        color: #302117;
        font: inherit;
      }

      .mc-delivery-button {
        padding: 12px 20px;
        border: 0;
        border-radius: 11px;
        background: #8b5b3a;
        color: white;
        font-weight: 800;
        cursor: pointer;
      }

      .mc-delivery-button:disabled {
        opacity: .6;
        cursor: wait;
      }

      .mc-delivery-result {
        margin-top: 15px;
        padding: 12px 14px;
        border-radius: 11px;
        line-height: 1.6;
        font-size: 13px;
      }

      .mc-delivery-result[hidden] {
        display: none;
      }

      .mc-delivery-success {
        background: #e8f7ed;
        border: 1px solid #b8e4c4;
        color: #146633;
      }

      .mc-delivery-unavailable {
        background: #fff0e7;
        border: 1px solid #f0ceb7;
        color: #92521c;
      }

      .mc-delivery-error {
        background: #fff1f1;
        border: 1px solid #efc0c0;
        color: #a52b2b;
      }

      .mc-delivery-note {
        margin: 12px 0 0;
        color: #817265;
        font-size: 11px;
        line-height: 1.6;
      }

      @media(max-width:550px) {
        .mc-delivery-checker {
          padding: 16px;
        }

        .mc-delivery-form {
          display: grid;
          grid-template-columns: 1fr 1fr;
        }

        .mc-delivery-pin {
          grid-column: 1 / -1;
          width: 100%;
        }

        .mc-delivery-mode,
        .mc-delivery-button {
          width: 100%;
        }
      }
    `;

    document.head.appendChild(style);
  }


  /* =====================================
     RESULT DISPLAY
  ===================================== */

  function showResult(box, message, type) {

    box.hidden = false;

    box.className =
      'mc-delivery-result ' +
      (
        type === 'success'
          ? 'mc-delivery-success'
          : type === 'unavailable'
            ? 'mc-delivery-unavailable'
            : 'mc-delivery-error'
      );

    box.textContent = message;
  }


  /* =====================================
     DELIVERY CHECK API
  ===================================== */

  async function checkDelivery(
    pin,
    paymentMethod,
    result,
    button
  ) {

    if (!/^[1-9][0-9]{5}$/.test(pin)) {

      showResult(
        result,
        'Please enter a valid 6-digit Indian PIN code.',
        'error'
      );

      return;
    }

    if (
      !['COD', 'PREPAID'].includes(
        paymentMethod
      )
    ) {
      showResult(
        result,
        'Please select a valid payment method.',
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
        'Delivery service is not ready. Please try again.',
        'error'
      );

      return;
    }

    button.disabled = true;
    button.textContent = 'Checking...';

    result.hidden = true;

    try {

      const endpoint =
        '/delivery/check?pincode=' +
        encodeURIComponent(pin) +
        '&paymentMethod=' +
        encodeURIComponent(paymentMethod);

      const response = await window.MC.api(
        endpoint
      );

      if (
        response.success === true &&
        response.available === true
      ) {

        showResult(
          result,
          '✓ Courier service is currently available ' +
          'for PIN ' + pin + ' (' +
          (paymentMethod === 'COD'
            ? 'Cash on Delivery'
            : 'Prepaid') +
          '). Final availability depends on ' +
          'parcel and courier details.',
          'success'
        );

      } else if (
        response.success === true &&
        response.available === false
      ) {

        showResult(
          result,
          'No matching courier service is currently ' +
          'available for PIN ' + pin + ' with ' +
          (paymentMethod === 'COD'
            ? 'Cash on Delivery.'
            : 'Prepaid delivery.') +
          ' You can try the other payment mode.',
          'unavailable'
        );

      } else {

        showResult(
          result,
          'Delivery availability could not be verified. ' +
          'Please try again later.',
          'error'
        );
      }

    } catch (error) {

      console.error(
        'Delivery availability check failed:',
        error
      );

      showResult(
        result,
        'Delivery availability is temporarily ' +
        'unavailable. Please try again later.',
        'error'
      );

    } finally {

      button.disabled = false;
      button.textContent = 'Check';

    }
  }


  /* =====================================
     BUILD WIDGET
  ===================================== */

  function buildChecker() {

    const root = make(
      'section',
      'mc-delivery-checker'
    );

    root.id = ROOT_ID;

    const header = make(
      'div',
      'mc-delivery-heading'
    );

    const icon = make(
      'span',
      'mc-delivery-icon',
      '🚚'
    );

    const titleBox = make('div');

    titleBox.append(
      make(
        'strong',
        null,
        'Check Delivery Availability'
      ),
      make(
        'small',
        null,
        'Check courier service for your PIN code'
      )
    );

    header.append(icon, titleBox);

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
    pin.placeholder = '6-digit PIN';
    pin.autocomplete = 'postal-code';
    pin.required = true;

    pin.setAttribute(
      'aria-label',
      'Delivery PIN code'
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
      'Payment method for delivery check'
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
      'mc-delivery-button',
      'Check'
    );

    button.type = 'submit';

    form.append(pin, mode, button);

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

        await checkDelivery(
          pin.value.trim(),
          mode.value,
          result,
          button
        );

      }
    );

    const note = make(
      'p',
      'mc-delivery-note',
      'Availability is an estimate of courier ' +
      'serviceability, not a guaranteed delivery ' +
      'date. Final service depends on the parcel ' +
      'weight, address and courier availability.'
    );

    root.append(
      header,
      form,
      result,
      note
    );

    return root;
  }


  /* =====================================
     INSERT ON PRODUCT PAGE
  ===================================== */

  function initialize() {

    const product = document.getElementById(
      'product'
    );

    if (!product) {
      return;
    }

    if (document.getElementById(ROOT_ID)) {
      return;
    }

    addStyles();

    const widget = buildChecker();

    product.after(widget);
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
