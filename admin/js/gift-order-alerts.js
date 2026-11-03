
'use strict';

/*
=========================================
 MEMORA CREATIONS
 ADMIN GIFT ORDER ALERTS

 - Red blinking gift order badge
 - Standard / Premium gift details
 - Personal gift message
 - Order details highlighting
 - No payment or status modifications
=========================================
*/

(() => {

  const STYLE_ID =
    'mc-admin-gift-alert-styles';

  const BADGE_CLASS =
    'mc-admin-gift-alert';

  const DETAILS_CLASS =
    'mc-admin-gift-details';


  /* =====================================
     ADD STYLES
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
        color: #fff;
        border: 2px solid #b91c1c;
        border-radius: 9px;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: .02em;
        animation:
          mcGiftAlertBlink 1.2s ease-in-out
          infinite;
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
     GET ORDERS LOADED BY ADMIN PAGE
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


  /* =====================================
     IDENTIFY GIFT ORDER
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


  /* =====================================
     GIFT DETAILS
  ===================================== */

  function getGiftDetails(order) {

    const gift = order.giftWrapping;

    const type =
      String(gift.type || '').toUpperCase();

    const label =
      type === 'PREMIUM'
        ? 'Premium Gift Wrapping'
        : 'Standard Gift Wrapping';

    const fee = Number(gift.fee);

    return {
      label,
      fee:
        Number.isFinite(fee) && fee >= 0
          ? fee
          : 0,
      message:
        typeof gift.message === 'string'
          ? gift.message
          : ''
    };
  }


  /* =====================================
     RED BLINKING BADGE
  ===================================== */

  function makeBadge() {

    const badge = document.createElement('span');

    badge.className = BADGE_CLASS;

    badge.textContent = '🎁 GIFT ORDER';

    badge.title =
      'Special gift wrapping required';

    return badge;
  }


  /* =====================================
     SHOW BADGE IN ORDERS LIST
  ===================================== */

  function decorateOrderRows() {

    for (const button of
      document.querySelectorAll(
        '#orders .view-order'
      )
    ) {

      const id = button.dataset.id;

      const order = getOrders().find(
        item => String(item._id) === String(id)
      );

      if (!order || !isGiftOrder(order)) {
        continue;
      }

      const cell = button.closest('td');

      if (
        !cell ||
        cell.querySelector(
          '.' + BADGE_CLASS
        )
      ) {
        continue;
      }

      const wrapper =
        document.createElement('div');

      wrapper.appendChild(makeBadge());

      button.before(wrapper);
    }
  }


  /* =====================================
     CREATE GIFT DETAILS CARD
  ===================================== */

  function buildGiftCard(order) {

    const gift = getGiftDetails(order);

    const card =
      document.createElement('section');

    card.className = DETAILS_CLASS;

    const heading =
      document.createElement('h3');

    heading.textContent =
      '🎁 SPECIAL GIFT ORDER';

    const type =
      document.createElement('p');

    const typeLabel =
      document.createElement('strong');

    typeLabel.textContent = 'Wrapping: ';

    type.appendChild(typeLabel);

    type.appendChild(
      document.createTextNode(gift.label)
    );

    const fee =
      document.createElement('p');

    const feeLabel =
      document.createElement('strong');

    feeLabel.textContent = 'Wrapping Fee: ';

    fee.appendChild(feeLabel);

    fee.appendChild(
      document.createTextNode(
        '₹' + gift.fee.toFixed(2)
      )
    );

    const messageLabel =
      document.createElement('strong');

    messageLabel.textContent =
      'Personal Gift Message:';

    const message =
      document.createElement('div');

    message.className =
      'mc-admin-gift-message';

    message.textContent =
      gift.message.trim() ||
      'No personal message added.';

    const reminder =
      document.createElement('p');

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


  /* =====================================
     SHOW CARD IN VIEW DETAILS
  ===================================== */

  function decorateDetailsRows() {

    for (const order of getOrders()) {

      if (!isGiftOrder(order)) {
        continue;
      }

      const detailsRow =
        document.getElementById(
          'details-' + order._id
        );

      if (
        !detailsRow ||
        !detailsRow.querySelector('td')
      ) {
        continue;
      }

      const detailsCell =
        detailsRow.querySelector('td');

      if (
        detailsCell.querySelector(
          '.' + DETAILS_CLASS
        )
      ) {
        continue;
      }

      const card = buildGiftCard(order);

      const headings = Array.from(
        detailsCell.querySelectorAll('h3')
      );

      const paymentHeading =
        headings.find(
          heading =>
            heading.textContent
              .trim()
              .toLowerCase() ===
            'payment & total'
        );

      if (paymentHeading) {
        paymentHeading.before(card);
      } else {
        detailsCell.prepend(card);
      }
    }
  }


  /* =====================================
     APPLY ALERTS
  ===================================== */

  function updateGiftAlerts() {

    installStyles();

    decorateOrderRows();

    decorateDetailsRows();
  }


  /* =====================================
     WATCH ORDER LIST UPDATES

     The existing admin page loads orders
     asynchronously and rebuilds rows
     after searching or updating status.
  ===================================== */

  function initialize() {

    const ordersTable =
      document.querySelector('#orders');

    if (!ordersTable) {
      return;
    }

    updateGiftAlerts();

    const observer =
      new MutationObserver(() => {
        updateGiftAlerts();
      });

    observer.observe(ordersTable, {
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
