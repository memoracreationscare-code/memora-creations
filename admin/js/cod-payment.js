
/*
==========================================
 MEMORA CREATIONS
 COD PAYMENT MANAGEMENT

 Mark as Paid - Admin Orders

 Works alongside existing orders.js
 Does not change Cashfree or Razorpay
==========================================
*/

(() => {
  'use strict';

  const API_PATH = '/admin/orders/';

  const BUTTON_CLASS = 'mc-cod-paid-btn';

  let paymentRequestRunning = false;


  /* =====================================
     CUSTOM BUTTON DESIGN
  ===================================== */

  function installStyles() {

    if (
      document.getElementById(
        'mc-cod-payment-style'
      )
    ) {
      return;
    }

    const style = document.createElement('style');

    style.id = 'mc-cod-payment-style';

    style.textContent = `
      .mc-cod-paid-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        margin-top: 10px;
        padding: 11px 13px;
        background: #166534;
        color: #fff;
        border: 0;
        border-radius: 11px;
        font-size: 12px;
        font-weight: 800;
        line-height: 1.4;
        cursor: pointer;
        transition:
          background .2s ease,
          opacity .2s ease;
      }

      .mc-cod-paid-btn:hover {
        background: #14532d;
      }

      .mc-cod-paid-btn:focus-visible {
        outline: 3px solid #86efac;
        outline-offset: 3px;
      }

      .mc-cod-paid-btn:disabled {
        opacity: .55;
        cursor: not-allowed;
      }

      .mc-cod-paid-note {
        display: block;
        margin-top: 7px;
        font-size: 11px;
        line-height: 1.5;
        color: #8a6b4e;
      }
    `;

    document.head.appendChild(style);
  }


  /* =====================================
     FIND COD ORDER DETAILS
  ===================================== */

  function getOrderId(row) {

    const select = row.querySelector(
      'select.order-status[data-id]'
    );

    return select?.dataset.id || null;
  }


  function getPaymentInfo(row) {

    const cells = row.children;

    if (cells.length !== 6) {
      return null;
    }

    const paymentCell = cells[3];

    const orderStatusCell = cells[4];

    /*
      Supports both the original
      orders.js markup and the newer
      colored-badge markup.
    */

    const methodElement =
      paymentCell.querySelector(
        '.mc-payment-method'
      );

    const statusElement =
      paymentCell.querySelector(
        '.mc-payment-badge'
      );

    const originalStatusElement =
      paymentCell.querySelector('.mini');

    const method = (
      methodElement?.textContent ||
      paymentCell.firstChild?.textContent ||
      ''
    ).trim().toUpperCase();

    const paymentStatus = (
      statusElement?.textContent ||
      originalStatusElement?.textContent ||
      ''
    ).trim().toUpperCase();

    const orderStatus = (
      orderStatusCell.textContent || ''
    ).trim();

    return {
      method,
      paymentStatus,
      orderStatus
    };
  }


  /* =====================================
     CHECK ELIGIBILITY
  ===================================== */

  function isEligibleCODOrder(row) {

    const info = getPaymentInfo(row);

    if (!info) return false;

    const isCOD =
      info.method === 'COD' ||
      info.method === 'CASH ON DELIVERY';

    const isPaymentPending =
      info.paymentStatus === 'COD_PENDING' ||
      info.paymentStatus === 'COD PENDING';

    const isDelivered =
      info.orderStatus === 'Delivered';

    return (
      isCOD &&
      isPaymentPending &&
      isDelivered
    );
  }


  /* =====================================
     ADD MARK AS PAID BUTTON
  ===================================== */

  function addPaymentButton(row) {

    if (row.children.length !== 6) {
      return;
    }

    const existingButton =
      row.querySelector(
        '.' + BUTTON_CLASS
      );

    if (existingButton) {
      return;
    }

    if (!isEligibleCODOrder(row)) {
      return;
    }

    const orderId = getOrderId(row);

    if (!orderId) {
      return;
    }

    const actionCell = row.children[5];

    if (!actionCell) {
      return;
    }

    const button =
      document.createElement('button');

    button.type = 'button';

    button.className = BUTTON_CLASS;

    button.dataset.orderId = orderId;

    button.textContent = '✓ Mark as Paid';

    button.title =
      'Confirm that COD money has actually been received';

    const note =
      document.createElement('span');

    note.className = 'mc-cod-paid-note';

    note.textContent =
      'Click only after receiving payment.';

    actionCell.appendChild(button);

    actionCell.appendChild(note);
  }


  /* =====================================
     SCAN ORDER ROWS
  ===================================== */

  function updateButtons() {

    const tbody =
      document.getElementById('orders');

    if (!tbody) {
      return;
    }

    const rows =
      tbody.querySelectorAll(
        ':scope > tr'
      );

    rows.forEach(addPaymentButton);
  }


  /* =====================================
     PAYMENT CONFIRMATION
  ===================================== */

  async function markOrderPaid(button) {

    if (paymentRequestRunning) {
      return;
    }

    const orderId =
      button.dataset.orderId;

    if (!orderId) {
      return;
    }

    /*
      Important:
      Delivered does NOT automatically
      mean that cash was received.
    */

    const confirmed = window.confirm(
      'COD PAYMENT CONFIRMATION\n\n' +
      'Have you actually received the ' +
      'cash payment for this order?\n\n' +
      'Press OK only if the full payment ' +
      'has been received.\n\n' +
      'This will change the payment ' +
      'status to SUCCESS.'
    );

    if (!confirmed) {
      return;
    }

    if (
      !window.MC ||
      typeof window.MC.api !== 'function'
    ) {

      window.alert(
        'Payment API is not available. ' +
        'Please refresh the page.'
      );

      return;
    }

    paymentRequestRunning = true;

    const oldText = button.textContent;

    button.disabled = true;

    button.textContent =
      'Confirming Payment...';

    try {

      const result = await window.MC.api(
        API_PATH +
        encodeURIComponent(orderId) +
        '/cod/paid',
        {
          method: 'PATCH',

          body: JSON.stringify({
            confirmed: true
          })
        }
      );

      const order = result?.order;

      if (
        order &&
        order.paymentStatus !== 'SUCCESS'
      ) {
        throw new Error(
          'Payment confirmation could not be verified.'
        );
      }

      if (
        window.MC.toast
      ) {
        window.MC.toast(
          'COD payment marked as received.',
          'success'
        );
      }

      /*
        Refresh data so both payment
        badge and order details show
        the updated database value.
      */

      window.location.reload();

    } catch (err) {

      console.error(
        'COD payment confirmation failed:',
        err
      );

      const message =
        err?.message ||
        'Payment update failed.';

      if (
        window.MC &&
        typeof window.MC.toast === 'function'
      ) {
        window.MC.toast(
          message,
          'error'
        );
      } else {
        window.alert(message);
      }

      button.disabled = false;

      button.textContent = oldText;

    } finally {

      paymentRequestRunning = false;

    }
  }


  /* =====================================
     BUTTON CLICK HANDLER
  ===================================== */

  function bindButtonClicks(tbody) {

    tbody.addEventListener(
      'click',
      async event => {

        const button = event.target.closest(
          '.' + BUTTON_CLASS
        );

        if (!button) {
          return;
        }

        const row = button.closest('tr');

        /*
          Verify current visible order
          status before sending request.
          Backend will verify again.
        */

        if (
          !row ||
          !isEligibleCODOrder(row)
        ) {
          window.alert(
            'This order is not eligible ' +
            'for COD payment confirmation.'
          );

          return;
        }

        await markOrderPaid(button);

      }
    );
  }


  /* =====================================
     INITIALIZE
  ===================================== */

  function initializeCODPayment() {

    const tbody =
      document.getElementById('orders');

    if (!tbody) {
      console.warn(
        'COD Payment: Orders table not found.'
      );

      return;
    }

    installStyles();

    bindButtonClicks(tbody);

    /*
      Existing orders.js reloads
      table rows after search and
      order status updates.

      MutationObserver ensures that
      eligible COD orders get their
      buttons after each reload.
    */

    let scheduled = false;

    const observer = new MutationObserver(() => {

      if (scheduled) {
        return;
      }

      scheduled = true;

      queueMicrotask(() => {

        scheduled = false;

        updateButtons();

      });

    });

    observer.observe(
      tbody,
      {
        childList: true,
        subtree: false
      }
    );

    updateButtons();

  }


  /* =====================================
     START
  ===================================== */

  if (
    document.readyState === 'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      initializeCODPayment,
      { once: true }
    );

  } else {

    initializeCODPayment();

  }

})();
