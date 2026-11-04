
/*
=========================================
 MEMORA CREATIONS
 CUSTOMER SHIPMENT TRACKING - VERSION 1

 Read-only customer shipment information.
 No payment, order or stock changes.
=========================================
*/

(() => {
  'use strict';

  const MC = window.MC;

  if (!MC?.api) return;

  const orderId = new URLSearchParams(
    location.search
  ).get('id');

  const orderBox = document.getElementById(
    'order'
  );

  if (!orderId || !orderBox) return;

  const panel = document.createElement('section');

  panel.id = 'mcShipmentTracking';

  panel.style.cssText = [
    'margin:20px 0',
    'padding:22px',
    'background:#fff',
    'border:1px solid #e9dfd4',
    'border-radius:18px',
    'line-height:1.8'
  ].join(';');

  const title = document.createElement('h2');
  title.textContent = 'Shipment Tracking';

  const content = document.createElement('div');
  content.textContent = 'Loading tracking details...';

  panel.append(title, content);
  orderBox.insertAdjacentElement('afterend', panel);

  function formatDate(value) {
    if (!value) return 'Not available';

    const date = new Date(value);

    if (!Number.isFinite(date.getTime())) {
      return 'Not available';
    }

    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata'
    }).format(date);
  }

  function addRow(label, value) {
    const row = document.createElement('p');
    row.style.margin = '8px 0';

    const strong = document.createElement('strong');
    strong.textContent = label + ': ';

    const span = document.createElement('span');
    span.textContent = value || 'Not available';

    row.append(strong, span);
    content.appendChild(row);
  }

  async function loadTracking() {
    try {
      const result = await MC.api(
        '/orders/' +
        encodeURIComponent(orderId) +
        '/shipment-tracking'
      );

      content.replaceChildren();

      if (!result.trackingAvailable) {
        content.textContent =
          result.message ||
          'Tracking will appear after courier assignment.';
        return;
      }

      const shipment = result.shipment || {};

      addRow(
        'Courier',
        shipment.courierName
      );

      addRow(
        'AWB / Tracking Number',
        shipment.awbCode
      );

      addRow(
        'Shipment Status',
        shipment.shipmentStatus
      );

      addRow(
        'Shipment Created',
        formatDate(shipment.shipmentCreatedAt)
      );

      addRow(
        'AWB Assigned',
        formatDate(shipment.awbAssignedAt)
      );

      addRow(
        'Picked Up',
        formatDate(shipment.pickedUpAt)
      );

      addRow(
        'Estimated Delivery',
        formatDate(shipment.estimatedDeliveryDate)
      );

      addRow(
        'Delivered',
        formatDate(shipment.deliveredAt)
      );

      if (shipment.trackingUrl) {
        try {
          const url = new URL(shipment.trackingUrl);

          if (url.protocol === 'https:') {
            const link = document.createElement('a');

            link.href = url.href;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = 'Track Shipment';

            link.style.cssText = [
              'display:inline-block',
              'margin-top:12px',
              'font-weight:700'
            ].join(';');

            content.appendChild(link);
          }
        } catch (_) {
          // Invalid URL: do not show tracking link.
        }
      }

    } catch (err) {
      content.textContent =
        'Shipment tracking is not available right now.';
    }
  }

  loadTracking();

})();
