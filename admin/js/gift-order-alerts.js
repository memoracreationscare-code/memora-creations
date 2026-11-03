
'use strict';

/*
=========================================
 MEMORA CREATIONS
 ADMIN GIFT ORDER ALERTS

 FEATURES:
 - Red blinking gift order badge
 - Standard / Premium gift details
 - Personal gift message
 - Special packaging reminder
 - Gift details on printed label
 - Normal order printing unchanged
 - No payment/status changes
=========================================
*/

(() => {
  const STYLE_ID = 'mc-admin-gift-alert-styles';
  const BADGE_CLASS = 'mc-admin-gift-alert';
  const DETAILS_CLASS = 'mc-admin-gift-details';

  const escapeHtml = value =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const money = value => {
    const amount = Number(value);

    return '₹' + (
      Number.isFinite(amount) ? amount : 0
    ).toFixed(2);
  };


  /* =====================================
     STYLES
  ===================================== */

  function installStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;

    style.textContent = `
      .${BADGE_CLASS} {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin: 8px 0;
        padding: 8px 12px;
        background: #dc2626;
        color: white;
        border: 2px solid #b91c1c;
        border-radius: 9px;
        font-size: 12px;
        font-weight: 800;
        animation:
          mcGiftAlertBlink 1.2s ease-in-out infinite;
      }

      @keyframes mcGiftAlertBlink {
        0%, 100% {
          background: #dc2626;
          box-shadow: 0 0 0 0 rgba(220,38,38,.4);
        }
        50% {
          background: #991b1b;
          box-shadow: 0 0 0 5px rgba(220,38,38,.13);
        }
      }

      .${DETAILS_CLASS} {
        margin: 18px 0;
        padding: 19px;
        border: 2px solid #dc2626;
        border-radius: 14px;
        background: #fff1f2;
        color: #7f1d1d;
      }

      .${DETAILS_CLASS} h3 {
        margin: 0 0 13px;
        color: #991b1b;
      }

      .mc-admin-gift-message {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        background: white;
        border: 1px solid #fecaca;
        padding: 13px;
        border-radius: 10px;
        line-height: 1.6;
      }

      @media (prefers-reduced-motion: reduce) {
        .${BADGE_CLASS} {
          animation: none;
        }
      }

      @media print {
        .${BADGE_CLASS} {
          animation: none;
        }
      }
    `;

    document.head.appendChild(style);
  }


  /* =====================================
     ADMIN ORDERS DATA
  ===================================== */

  function getOrders() {
    if (
      typeof adminOrders === 'undefined' ||
      !Array.isArray(adminOrders)
    ) {
      return [];
    }

    return adminOrders;
  }

  function findOrder(id) {
    return getOrders().find(
      order => String(order._id) === String(id)
    );
  }


  /* =====================================
     GIFT ORDER VALIDATION
  ===================================== */

  function isGiftOrder(order) {
    const gift = order?.giftWrapping;

    return Boolean(
      gift &&
      gift.selected === true &&
      ['STANDARD', 'PREMIUM'].includes(
        String(gift.type || '').toUpperCase()
      )
    );
  }

  function getGiftDetails(order) {
    const gift = order.giftWrapping;

    const type = String(
      gift.type || ''
    ).toUpperCase();

    const fee = Number(gift.fee);

    return {
      type,
      label:
        type === 'PREMIUM'
          ? 'Premium Gift Wrapping'
          : 'Standard Gift Wrapping',

      fee:
        Number.isFinite(fee) && fee >= 0
          ? fee
          : 0,

      message:
        typeof gift.message === 'string'
          ? gift.message.trim()
          : ''
    };
  }


  /* =====================================
     BLINKING BADGE
  ===================================== */

  function makeBadge() {
    const badge = document.createElement('span');

    badge.className = BADGE_CLASS;
    badge.textContent = '🎁 GIFT ORDER';

    badge.title =
      'Special gift wrapping required';

    return badge;
  }

  function decorateOrderRows() {
    for (
      const button of document.querySelectorAll(
        '#orders .view-order'
      )
    ) {
      const order = findOrder(button.dataset.id);

      if (!isGiftOrder(order)) {
        continue;
      }

      const cell = button.closest('td');

      if (
        !cell ||
        cell.querySelector('.' + BADGE_CLASS)
      ) {
        continue;
      }

      const wrapper = document.createElement('div');
      wrapper.appendChild(makeBadge());

      button.before(wrapper);
    }
  }


  /* =====================================
     GIFT DETAILS CARD
  ===================================== */

  function buildGiftCard(order) {
    const gift = getGiftDetails(order);

    const card = document.createElement('section');
    card.className = DETAILS_CLASS;

    const heading = document.createElement('h3');
    heading.textContent = '🎁 SPECIAL GIFT ORDER';

    const type = document.createElement('p');
    type.textContent = 'Wrapping: ' + gift.label;

    const fee = document.createElement('p');
    fee.textContent =
      'Wrapping Fee: ' + money(gift.fee);

    const messageLabel =
      document.createElement('strong');

    messageLabel.textContent =
      'Personal Gift Message:';

    const message = document.createElement('div');
    message.className = 'mc-admin-gift-message';

    message.textContent =
      gift.message || 'No personal message added.';

    const reminder = document.createElement('p');
    reminder.style.fontSize = '12px';
    reminder.style.fontWeight = '700';

    reminder.textContent =
      'Packing reminder: Check gift wrapping ' +
      'and message before dispatch.';

    card.append(
      heading,
      type,
      fee,
      messageLabel,
      message,
      reminder
    );

    return card;
  }

  function decorateDetailsRows() {
    for (const order of getOrders()) {
      if (!isGiftOrder(order)) {
        continue;
      }

      const row = document.getElementById(
        'details-' + order._id
      );

      if (!row) {
        continue;
      }

      const cell = row.querySelector('td');

      if (
        !cell ||
        cell.querySelector('.' + DETAILS_CLASS)
      ) {
        continue;
      }

      const card = buildGiftCard(order);

      const paymentHeading = Array.from(
        cell.querySelectorAll('h3')
      ).find(
        heading =>
          heading.textContent
            .trim()
            .toLowerCase() === 'payment & total'
      );

      if (paymentHeading) {
        paymentHeading.before(card);
      } else {
        cell.prepend(card);
      }
    }
  }


  /* =====================================
     PRINT GIFT PACKAGING LABEL

     Intercepts printing only for
     confirmed gift selections.

     Normal orders continue using
     the original admin print code.
  ===================================== */

  function buildGiftPackagingLabel(order) {
    const gift = getGiftDetails(order);

    const address = order.shippingAddress || {};

    const customer =
      order.customer?.fullName ||
      order.user?.fullName ||
      address.fullName ||
      'Customer';

    const mobile =
      order.customer?.mobile ||
      address.mobile ||
      '';

    const payment =
      order.paymentMethod === 'COD'
        ? 'COD: ' + money(order.grandTotal)
        : 'PREPAID';

    const products = (order.items || [])
      .map((item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>${Number(item.quantity) || 0}</td>
        </tr>
      `).join('');

    const giftMessage =
      gift.message
        ? escapeHtml(gift.message)
        : 'No personal message added.';

    return `
      <!doctype html>
      <html lang="en">
      <head>
        <meta charset="utf-8">

        <title>Memora Gift Packaging Label</title>

        <style>
          * {
            box-sizing: border-box;
          }

          body {
            font-family: Arial, sans-serif;
            padding: 22px;
            color: #111;
          }

          h2 {
            text-align: center;
          }

          .box {
            border: 2px solid #222;
            padding: 15px;
            margin: 15px 0;
          }

          .gift-box {
            border: 3px solid #b91c1c;
            padding: 17px;
            margin-top: 18px;
            background: #fff4f4;
            break-inside: avoid;
          }

          .gift-title {
            font-weight: 900;
            font-size: 20px;
            color: #b91c1c;
          }

          .gift-message {
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            padding: 12px;
            border: 1px solid #e7b5b5;
            background: white;
            font-size: 15px;
            line-height: 1.6;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
          }

          th, td {
            border: 1px solid #555;
            padding: 9px;
            text-align: left;
          }

          @media print {
            body {
              padding: 5px;
            }

            .gift-box {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>

      <body>
        <h2>MEMORA CREATIONS</h2>

        <h3>Shipping / Packaging Label</h3>

        <div class="box">
          <p>
            <b>Order:</b>
            ${escapeHtml(order.orderId)}
          </p>

          <p>
            <b>Customer:</b>
            ${escapeHtml(customer)}
          </p>

          <p>
            <b>Mobile:</b>
            ${escapeHtml(mobile)}
          </p>

          <p>
            <b>Address:</b>
            ${escapeHtml(address.addressLine)}
          </p>

          <p>
            ${escapeHtml(address.city)},
            ${escapeHtml(address.state)}
          </p>

          <p>
            <b>PIN:</b>
            ${escapeHtml(address.pinCode)}
          </p>

          <p>
            <b>Payment:</b>
            ${escapeHtml(payment)}
          </p>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Product</th>
              <th>Quantity</th>
            </tr>
          </thead>

          <tbody>
            ${products}
          </tbody>
        </table>

        <div class="gift-box">
          <div class="gift-title">
            SPECIAL GIFT ORDER
          </div>

          <p>
            <b>Wrapping:</b>
            ${escapeHtml(gift.label)}
          </p>

          <p>
            <b>Wrapping Fee:</b>
            ${money(gift.fee)}
          </p>

          <p>
            <b>Personal Gift Message:</b>
          </p>

          <div class="gift-message">${giftMessage}</div>

          <p>
            <b>PACKING REMINDER:</b>
            Verify wrapping and message before dispatch.
          </p>
        </div>
      </body>
      </html>
    `;
  }


  /* =====================================
     OPEN PRINT LABEL
  ===================================== */

  function printGiftLabel(order) {
    const html = buildGiftPackagingLabel(order);

    const blob = new Blob(
      [html],
      { type: 'text/html' }
    );

    const url = URL.createObjectURL(blob);

    const printWindow = window.open(
      url,
      '_blank'
    );

    if (!printWindow) {
      URL.revokeObjectURL(url);

      window.MC.toast(
        'Please allow the print popup.',
        'error'
      );

      return;
    }

    printWindow.addEventListener(
      'load',
      () => {
        printWindow.focus();
        printWindow.print();

        setTimeout(
          () => URL.revokeObjectURL(url),
          30000
        );
      },
      { once: true }
    );
  }


  /* =====================================
     PRINT CLICK INTERCEPTION

     Only gift orders get enhanced
     packaging labels.

     All other orders use the existing
     Print Packaging Label function.
  ===================================== */

  function handlePrintClick(event) {
    const button = event.target.closest(
      '.print-label'
    );

    if (!button) {
      return;
    }

    const row = button.closest(
      'tr[id^="details-"]'
    );

    if (!row) {
      return;
    }

    const id = row.id.slice(
      'details-'.length
    );

    const order = findOrder(id);

    if (!isGiftOrder(order)) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    printGiftLabel(order);
  }


  /* =====================================
     UPDATE GIFT ALERTS
  ===================================== */

  function updateGiftAlerts() {
    installStyles();

    decorateOrderRows();
    decorateDetailsRows();
  }


  /* =====================================
     INITIALIZE
  ===================================== */

  function initialize() {
    const table =
      document.querySelector('#orders');

    if (!table) {
      return;
    }

    updateGiftAlerts();

    /*
      Capture click before the existing
      Print Packaging Label handler.
    */

    document.addEventListener(
      'click',
      handlePrintClick,
      true
    );

    /*
      Reapply alerts when orders are
      loaded or details are opened.
    */

    const observer = new MutationObserver(() => {
      updateGiftAlerts();
    });

    observer.observe(table, {
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
