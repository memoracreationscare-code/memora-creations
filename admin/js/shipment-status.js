
/*
=========================================
 MEMORA CREATIONS
 ADMIN SHIPROCKET SHIPMENT STATUS
 VERSION 1

 - Existing shipment details
 - Courier and AWB information
 - Selected courier ETA
 - Prevent duplicate shipment actions
 - Read-only status request
 - No changes to payment or orders
=========================================
*/

(() => {
  'use strict';

  const API_SUFFIX = '/shipment-status';

  function createElement(tag, text) {
    const element = document.createElement(tag);

    if (text !== undefined) {
      element.textContent = String(text);
    }

    return element;
  }

  function formatDate(value, dateOnly = false) {
    if (!value) {
      return 'Not available';
    }

    const date = new Date(value);

    if (!Number.isFinite(date.getTime())) {
      return 'Not available';
    }

    const options = {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: dateOnly
        ? 'UTC'
        : 'Asia/Kolkata'
    };

    if (!dateOnly) {
      options.hour = 'numeric';
      options.minute = '2-digit';
    }

    return new Intl.DateTimeFormat(
      'en-IN',
      options
    ).format(date);
  }

  function addDetail(container, label, value) {
    const row = createElement('p');
    row.style.margin = '8px 0';

    const title = createElement(
      'strong',
      label + ': '
    );

    const text = createElement(
      'span',
      value === null ||
      value === undefined ||
      value === ''
        ? 'Not available'
        : value
    );

    row.append(title, text);
    container.appendChild(row);
  }

  function lockShipmentForm(row) {
    const form = row.querySelector(
      '.shipment-form'
    );

    if (!form) return;

    const createButton = form.querySelector(
      '.create-shipment'
    );

    const ratesButton = form.querySelector(
      '.check-couriers'
    );

    if (createButton) {
      createButton.disabled = true;
      createButton.textContent =
        'Shipment Already Registered';
    }

    if (ratesButton) {
      ratesButton.disabled = true;
    }
  }

  function makePanel(row) {
    const existing = row.querySelector(
      '.mc-existing-shipment-status'
    );

    if (existing) {
      return existing;
    }

    const panel = createElement('section');

    panel.className =
      'mc-existing-shipment-status admin-card';

    panel.style.cssText = [
      'margin:18px 0',
      'padding:18px',
      'border:1px solid #e5d6c8',
      'border-radius:14px',
      'background:#fffaf5',
      'line-height:1.7'
    ].join(';');

    const title = createElement(
      'h3',
      'Shiprocket Shipment Status'
    );

    const content = createElement(
      'div',
      'Checking existing shipment...'
    );

    content.className =
      'mc-shipment-status-content';

    content.setAttribute(
      'aria-live',
      'polite'
    );

    panel.append(title, content);

    const shipmentForm = row.querySelector(
      '.shipment-form'
    );

    if (shipmentForm) {
      const wrapper = shipmentForm.closest(
        '.admin-card'
      );

      if (wrapper) {
        wrapper.insertAdjacentElement(
          'beforebegin',
          panel
        );

        return panel;
      }
    }

    const card = row.querySelector(
      '.admin-card'
    );

    if (card) {
      card.appendChild(panel);
    } else {
      row.appendChild(panel);
    }

    return panel;
  }

  async function loadShipmentStatus(
    orderId,
    row
  ) {
    if (!window.MC?.api) return;

    const panel = makePanel(row);

    const content = panel.querySelector(
      '.mc-shipment-status-content'
    );

    if (!content) return;

    content.textContent =
      'Checking existing shipment...';

    /*
      Safety: disable submission until
      we know whether an existing
      shipment record is present.
    */

    const createButton = row.querySelector(
      '.create-shipment'
    );

    const ratesButton = row.querySelector(
      '.check-couriers'
    );

    if (createButton) {
      createButton.disabled = true;
    }

    if (ratesButton) {
      ratesButton.disabled = true;
    }

    try {
      const result = await window.MC.api(
        '/admin/orders/' +
        encodeURIComponent(orderId) +
        API_SUFFIX
      );

      if (!row.isConnected) return;

      content.replaceChildren();

      if (result.shipmentExists === false) {
        content.textContent =
          'No Shiprocket shipment has been registered for this order.';

        if (ratesButton) {
          ratesButton.disabled = false;
        }

        /*
          Keep Create Shipment disabled.
          The existing Orders script will
          enable it only after a successful
          courier rate check.
        */

        return;
      }

      if (
        result.shipmentExists !== true ||
        !result.shipment
      ) {
        content.textContent =
          'Shipment status could not be verified.';

        lockShipmentForm(row);
        return;
      }

      const shipment = result.shipment;

      addDetail(
        content,
        'Shiprocket Order ID',
        shipment.shiprocketOrderId
      );

      addDetail(
        content,
        'Shipment ID',
        shipment.shipmentId
      );

      addDetail(
        content,
        'Courier',
        shipment.courierName
      );

      addDetail(
        content,
        'AWB Number',
        shipment.awbCode
      );

      addDetail(
        content,
        'Shipment Status',
        shipment.shipmentStatus
      );

      addDetail(
        content,
        'Shipment Created',
        formatDate(
          shipment.shipmentCreatedAt
        )
      );

      addDetail(
        content,
        'AWB Assigned',
        formatDate(
          shipment.awbAssignedAt
        )
      );

      addDetail(
        content,
        'Estimated Delivery',
        formatDate(
          shipment.estimatedDeliveryDate,
          true
        )
      );

      addDetail(
        content,
        'Picked Up',
        formatDate(shipment.pickedUpAt)
      );

      addDetail(
        content,
        'Delivered',
        formatDate(shipment.deliveredAt)
      );

      const warning = createElement(
        'p',
        shipment.shipmentStatus ===
          'NEEDS_MANUAL_REVIEW'
          ? 'Manual review required. Verify this shipment in Shiprocket before taking further action.'
          : 'An existing shipment record was found. Duplicate shipment creation is disabled.'
      );

      warning.style.cssText = [
        'font-weight:600',
        'margin-top:14px'
      ].join(';');

      content.appendChild(warning);

      lockShipmentForm(row);

    } catch (error) {
      if (!row.isConnected) return;

      content.textContent =
        'Could not verify existing shipment. ' +
        'Shipment creation is disabled for safety.';

      lockShipmentForm(row);

      console.warn(
        '[Admin Shipment Status]',
        error.message
      );
    }
  }

  /*
    When admin clicks View Details,
    the existing Orders script first
    renders the order form.

    Then this separate script adds the
    existing shipment status panel.
  */

  document.addEventListener(
    'click',
    event => {
      const button = event.target.closest(
        '.view-order'
      );

      if (!button) return;

      const orderId = button.dataset.id;

      if (
        !orderId ||
        !/^[a-fA-F0-9]{24}$/.test(orderId)
      ) {
        return;
      }

      queueMicrotask(() => {
        const row = document.getElementById(
          'details-' + orderId
        );

        if (!row) return;

        loadShipmentStatus(
          orderId,
          row
        );
      });
    }
  );

})();
