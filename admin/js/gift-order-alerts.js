
'use strict';

/*
==================================================
 MEMORA CREATIONS
 PREMIUM PACKAGING LABEL V3

 FEATURES:
 - Premium print-friendly A4 layout
 - Brand logo / monogram area
 - Scannable Order QR Code
 - Scannable Code 128 Order Barcode
 - COD / Prepaid badge
 - Fragile / Handle With Care warnings
 - Gift Order Premium / Standard theme
 - Gift message and wrapping details
 - Customer shipping address
 - Order items and quantities
 - Gift order alert on Admin page

 SAFETY:
 - No order/payment modifications
 - No Shiprocket shipment creation
 - QR and barcode are ORDER references,
   NOT carrier AWB/tracking codes.
==================================================
*/

(() => {
  const BRAND = 'MEMORA CREATIONS';

  const TAGLINE =
    'Thoughtful Gifts • Beautiful Spaces';

  const STYLE_ID = 'mc-gift-premium-style';

  const CODE128_CDN =
    'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js';

  const QR_CDN =
    'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';


  /* ===================================
     BASIC UTILITIES
  =================================== */

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function text(value, fallback = '-') {
    const clean = String(value ?? '').trim();
    return clean || fallback;
  }

  function money(value) {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
      return '-';
    }

    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  }

  function date(value) {
    if (!value) return '-';

    const parsed = new Date(value);

    if (!Number.isFinite(parsed.getTime())) {
      return '-';
    }

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata'
    }).format(parsed);
  }

  function orders() {
    return typeof adminOrders !== 'undefined' &&
      Array.isArray(adminOrders)
      ? adminOrders
      : [];
  }

  function findOrder(id) {
    return orders().find(
      order => String(order._id) === String(id)
    );
  }

  function isGift(order) {
    const wrapping = order?.giftWrapping;

    return Boolean(
      wrapping?.selected === true &&
      ['STANDARD', 'PREMIUM'].includes(
        String(wrapping.type || '').toUpperCase()
      )
    );
  }

  function giftInfo(order) {
    const wrapping = order.giftWrapping || {};

    return {
      type: String(
        wrapping.type || 'STANDARD'
      ).toUpperCase(),

      fee: Number.isFinite(Number(wrapping.fee))
        ? Number(wrapping.fee)
        : 0,

      message: String(
        wrapping.message || ''
      ).trim()
    };
  }


  /* ===================================
     GIFT ALERTS ON ADMIN PAGE
  =================================== */

  function installStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');

    style.id = STYLE_ID;

    style.textContent = `
      .mc-admin-gift-alert {
        display: inline-flex;
        margin: 8px 0;
        padding: 8px 12px;
        border-radius: 9px;
        background: #b42318;
        color: white;
        font-size: 12px;
        font-weight: 800;
        animation:
          mcGiftPremiumBlink 1.4s infinite;
      }

      @keyframes mcGiftPremiumBlink {
        50% {
          background: #7f1d1d;
        }
      }

      .mc-admin-gift-details {
        margin: 18px 0;
        padding: 18px;
        border: 2px solid #d8a254;
        border-radius: 14px;
        background: #fff8ed;
        color: #51331e;
        line-height: 1.7;
      }

      .mc-admin-gift-details h3 {
        margin-top: 0;
        color: #8b452e;
      }

      .mc-admin-gift-message {
        padding: 12px;
        border: 1px solid #ead7b8;
        border-radius: 9px;
        background: white;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }

      @media (prefers-reduced-motion: reduce) {
        .mc-admin-gift-alert {
          animation: none;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function decorateRows() {
    for (
      const button of document.querySelectorAll(
        '#orders .view-order'
      )
    ) {
      const order = findOrder(button.dataset.id);

      if (!isGift(order)) continue;

      const cell = button.closest('td');

      if (
        !cell ||
        cell.querySelector('.mc-admin-gift-alert')
      ) {
        continue;
      }

      const badge = document.createElement('div');

      badge.className = 'mc-admin-gift-alert';

      badge.textContent =
        giftInfo(order).type === 'PREMIUM'
          ? '🎁 PREMIUM GIFT ORDER'
          : '🎁 GIFT ORDER';

      button.before(badge);
    }
  }

  function decorateGiftDetails() {
    for (const order of orders()) {
      if (!isGift(order)) continue;

      const row = document.getElementById(
        'details-' + order._id
      );

      if (!row) continue;

      const cell = row.querySelector('td');

      if (
        !cell ||
        cell.querySelector('.mc-admin-gift-details')
      ) {
        continue;
      }

      const gift = giftInfo(order);

      const card = document.createElement('section');

      card.className = 'mc-admin-gift-details';

      const heading = document.createElement('h3');
      heading.textContent = '🎁 SPECIAL GIFT ORDER';

      const wrapping = document.createElement('p');
      wrapping.textContent =
        'Wrapping: ' +
        (gift.type === 'PREMIUM'
          ? 'Premium Gift Wrapping'
          : 'Standard Gift Wrapping');

      const fee = document.createElement('p');
      fee.textContent =
        'Wrapping Fee: ' + money(gift.fee);

      const label = document.createElement('strong');
      label.textContent = 'Personal Gift Message:';

      const message = document.createElement('div');
      message.className = 'mc-admin-gift-message';
      message.textContent =
        gift.message || 'No personal message added.';

      const reminder = document.createElement('p');
      reminder.textContent =
        'Packing reminder: Verify wrapping, ' +
        'message and ordered products.';

      card.append(
        heading,
        wrapping,
        fee,
        label,
        message,
        reminder
      );

      const paymentHeading = Array.from(
        cell.querySelectorAll('h3')
      ).find(
        node =>
          node.textContent.trim().toLowerCase() ===
          'payment & total'
      );

      if (paymentHeading) {
        paymentHeading.before(card);
      } else {
        cell.prepend(card);
      }
    }
  }


  /* ===================================
     LABEL DATA
  =================================== */

  function orderDetails(order) {
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

    const addressParts = [
      address.addressLine,
      address.addressLine2,
      address.landmark,
      [address.city, address.state]
        .filter(Boolean)
        .join(', ')
    ].filter(Boolean);

    return {
      orderId: String(
        order.orderId || order._id || ''
      ),

      customer,
      mobile,
      addressParts,

      pin: String(address.pinCode || ''),

      paymentMethod: String(
        order.paymentMethod || ''
      ).toUpperCase(),

      paymentStatus: String(
        order.paymentStatus || ''
      ).toUpperCase(),

      orderStatus: String(
        order.orderStatus || 'Order Placed'
      ),

      total: order.grandTotal,

      createdAt: order.createdAt,

      items: Array.isArray(order.items)
        ? order.items
        : [],

      gift: isGift(order)
        ? giftInfo(order)
        : null
    };
  }


  /* ===================================
     PRINT LABEL HTML
  =================================== */

  function buildLabel(order) {
    const data = orderDetails(order);

    const gift = data.gift;

    const isCod =
      data.paymentMethod === 'COD';

    const paymentBadge = isCod
      ? 'CASH ON DELIVERY'
      : 'PREPAID ORDER';

    const giftTitle = gift
      ? gift.type === 'PREMIUM'
        ? 'PREMIUM GIFT PACKAGE'
        : 'SPECIAL GIFT PACKAGE'
      : 'STANDARD PACKAGE';

    const itemRows = data.items.map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${esc(text(item.name, 'Product'))}</td>
          <td class="center">
            ${esc(Number(item.quantity) || 1)}
          </td>
        </tr>
      `
    ).join('');

    const addressHtml = data.addressParts
      .map(part => `<div>${esc(part)}</div>`)
      .join('');

    const giftSection = gift
      ? `
        <section class="gift-card">
          <div class="gift-title">
            🎁 ${esc(giftTitle)}
          </div>

          <div class="gift-meta">
            <strong>Wrapping:</strong>
            ${esc(gift.type)}
          </div>

          <div class="gift-meta">
            <strong>Gift Wrapping Fee:</strong>
            ${money(gift.fee)}
          </div>

          <div class="gift-label">
            PERSONAL GIFT MESSAGE
          </div>

          <div class="gift-message">
            ${esc(
              gift.message ||
              'No personal message added.'
            )}
          </div>

          <div class="gift-reminder">
            Verify gift wrapping and message
            before sealing the parcel.
          </div>
        </section>
      `
      : '';

    const qrPayload = JSON.stringify(
      data.orderId
    ).replace(/</g, '\\u003c');

    return `
<!doctype html>
<html lang="en">

<head>
  <meta charset="utf-8">

  <meta
    name="viewport"
    content="width=device-width,initial-scale=1"
  >

  <title>
    Memora Packaging Label - ${esc(data.orderId)}
  </title>

  <style>
    @page {
      size: A4 portrait;
      margin: 10mm;
    }

    :root {
      --brown: #63422c;
      --dark: #251a14;
      --cream: #f7eee4;
      --gold: #d8b078;
      --line: #d8c9b9;
      --red: #9c2828;
    }

    * {
      box-sizing: border-box;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    body {
      margin: 0;
      background: #eee9e4;
      color: var(--dark);
      font-family: Arial, Helvetica, sans-serif;
    }

    .toolbar {
      display: flex;
      justify-content: center;
      gap: 10px;
      padding: 14px;
    }

    .toolbar button {
      border: 0;
      border-radius: 8px;
      padding: 11px 20px;
      font-weight: 800;
      cursor: pointer;
    }

    #printBtn {
      background: var(--brown);
      color: white;
    }

    .close-btn {
      background: #ddd3ca;
      color: #251a14;
    }

    .sheet {
      width: 190mm;
      min-height: 270mm;
      margin: 0 auto 20px;
      padding: 9mm;
      background: white;
      box-shadow: 0 6px 28px #00000015;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      border-bottom: 3px solid var(--brown);
      padding-bottom: 14px;
    }

    .brand-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo {
      width: 60px;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 13px;
      background: var(--dark);
      color: white;
      font-family: Georgia, serif;
      font-size: 25px;
      font-weight: 900;
      flex-shrink: 0;
    }

    .brand {
      font-size: 24px;
      font-weight: 900;
      letter-spacing: .5px;
      color: var(--dark);
    }

    .tagline {
      margin-top: 5px;
      font-size: 11px;
      color: #786456;
    }

    .label-type {
      padding: 10px 12px;
      border: 2px solid var(--brown);
      border-radius: 9px;
      color: var(--brown);
      font-size: 12px;
      font-weight: 900;
      text-align: center;
    }

    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 9px;
      margin: 15px 0;
    }

    .badge {
      border-radius: 7px;
      border: 1px solid var(--line);
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 900;
    }

    .payment {
      background: ${isCod ? '#fff0dc' : '#e9f5e8'};
      color: ${isCod ? '#79500e' : '#276336'};
    }

    .fragile {
      background: #fff0f0;
      border-color: #ddb7b7;
      color: var(--red);
    }

    .care {
      background: #f7f1e9;
      color: var(--brown);
    }

    .gift-badge {
      background: #fff4df;
      border-color: var(--gold);
      color: #85521a;
    }

    .info-grid {
      display: grid;
      grid-template-columns: 1.2fr .8fr;
      gap: 12px;
      margin: 14px 0;
    }

    .card {
      border: 1.5px solid var(--line);
      border-radius: 12px;
      overflow: hidden;
      break-inside: avoid;
    }

    .card-title {
      padding: 10px 13px;
      background: var(--cream);
      border-bottom: 1px solid var(--line);
      font-size: 12px;
      letter-spacing: 1px;
      font-weight: 900;
    }

    .card-body {
      padding: 14px;
      font-size: 13px;
      line-height: 1.65;
      overflow-wrap: anywhere;
    }

    .customer-name {
      font-size: 19px;
      font-weight: 900;
      margin-bottom: 8px;
    }

    .pin-box {
      display: inline-block;
      margin-top: 10px;
      padding: 7px 10px;
      border: 2px solid var(--dark);
      font-weight: 900;
      font-size: 15px;
    }

    .detail {
      margin: 8px 0;
    }

    .muted {
      color: #75665d;
      font-size: 11px;
    }

    .reference-card {
      display: grid;
      grid-template-columns: 1fr 126px;
      align-items: center;
      gap: 12px;
      margin: 14px 0;
      padding: 14px;
      border: 1.5px solid var(--line);
      border-radius: 12px;
      break-inside: avoid;
    }

    .reference-title {
      font-size: 11px;
      letter-spacing: 1px;
      font-weight: 900;
      color: #725847;
    }

    .reference-number {
      margin: 7px 0;
      font-size: 19px;
      font-weight: 900;
      overflow-wrap: anywhere;
    }

    #barcode {
      display: block;
      max-width: 100%;
      width: 100%;
      height: 65px;
      margin-top: 9px;
    }

    .qr-area {
      display: flex;
      align-items: center;
      flex-direction: column;
      gap: 5px;
      font-size: 10px;
      font-weight: 800;
      text-align: center;
    }

    #qrcode {
      width: 108px;
      min-height: 108px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: white;
    }

    #qrcode img,
    #qrcode canvas {
      max-width: 108px;
      max-height: 108px;
    }

    .scan-error {
      color: #a12828;
      font-size: 10px;
      font-weight: 700;
    }

    .section-title {
      margin: 17px 0 8px;
      font-size: 13px;
      font-weight: 900;
      letter-spacing: .8px;
      color: var(--brown);
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th,
    td {
      border: 1px solid var(--line);
      padding: 11px;
      font-size: 12px;
      vertical-align: top;
      overflow-wrap: anywhere;
    }

    th {
      background: var(--cream);
      font-weight: 900;
      text-align: left;
    }

    .center {
      text-align: center;
    }

    .payment-summary {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin: 14px 0;
      padding: 15px;
      border: 2px solid var(--brown);
      border-radius: 11px;
      background: #fcf8f4;
      font-weight: 900;
    }

    .payment-total {
      font-size: 23px;
      color: var(--brown);
    }

    .gift-card {
      margin: 16px 0;
      padding: 16px;
      border: 2px solid var(--gold);
      border-radius: 13px;
      background: #fff9ef;
      break-inside: avoid;
    }

    .gift-title {
      font-size: 18px;
      color: #845018;
      font-weight: 900;
      margin-bottom: 12px;
    }

    .gift-meta {
      margin: 7px 0;
      font-size: 13px;
    }

    .gift-label {
      margin-top: 14px;
      font-size: 11px;
      letter-spacing: .7px;
      font-weight: 900;
    }

    .gift-message {
      margin-top: 7px;
      padding: 12px;
      background: white;
      border: 1px solid #e4ccaa;
      border-radius: 8px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-size: 13px;
      line-height: 1.6;
    }

    .gift-reminder {
      margin-top: 12px;
      color: #845018;
      font-size: 11px;
      font-weight: 800;
    }

    .note {
      padding: 12px;
      border: 1px dashed #bca58d;
      border-radius: 10px;
      font-size: 11px;
      color: #69564a;
      line-height: 1.6;
      break-inside: avoid;
    }

    .footer {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding-top: 12px;
      margin-top: 15px;
      border-top: 1px solid var(--line);
      font-size: 11px;
      color: #7d6d61;
    }

    @media print {
      body {
        background: white;
      }

      .toolbar {
        display: none !important;
      }

      .sheet {
        width: auto;
        min-height: 0;
        margin: 0;
        padding: 0;
        box-shadow: none;
      }
    }

    @media screen and (max-width: 700px) {
      .sheet {
        width: calc(100% - 16px);
        min-height: 0;
        padding: 14px;
      }

      .header {
        flex-wrap: wrap;
      }

      .info-grid {
        grid-template-columns: 1fr;
      }

      .reference-card {
        grid-template-columns: 1fr;
      }
    }
  </style>

  <script src="${CODE128_CDN}"></script>
  <script src="${QR_CDN}"></script>
</head>

<body>

  <div class="toolbar">
    <button id="printBtn" type="button">
      Print A4 Label
    </button>

    <button
      class="close-btn"
      type="button"
      onclick="window.close()"
    >
      Close
    </button>
  </div>

  <main class="sheet">

    <header class="header">
      <div class="brand-group">
        <div class="logo">MC</div>

        <div>
          <div class="brand">
            ${esc(BRAND)}
          </div>

          <div class="tagline">
            ${esc(TAGLINE)}
          </div>
        </div>
      </div>

      <div class="label-type">
        PACKAGING LABEL
        <div class="muted">ORDER REFERENCE</div>
      </div>
    </header>

    <div class="badges">
      <span class="badge payment">
        ${esc(paymentBadge)}
      </span>

      <span class="badge fragile">
        FRAGILE
      </span>

      <span class="badge care">
        HANDLE WITH CARE
      </span>

      ${gift
        ? `<span class="badge gift-badge">
             ${esc(giftTitle)}
           </span>`
        : ''}
    </div>

    <div class="info-grid">

      <section class="card">
        <div class="card-title">
          SHIP TO / CUSTOMER
        </div>

        <div class="card-body">
          <div class="customer-name">
            ${esc(data.customer)}
          </div>

          ${addressHtml}

          <div class="pin-box">
            PIN: ${esc(text(data.pin))}
          </div>

          <div class="detail">
            <strong>Mobile:</strong>
            ${esc(text(data.mobile))}
          </div>
        </div>
      </section>

      <section class="card">
        <div class="card-title">
          ORDER DETAILS
        </div>

        <div class="card-body">
          <div class="detail">
            <strong>Order Date:</strong>
            ${esc(date(data.createdAt))}
          </div>

          <div class="detail">
            <strong>Order Status:</strong>
            ${esc(data.orderStatus)}
          </div>

          <div class="detail">
            <strong>Payment:</strong>
            ${esc(data.paymentMethod)}
          </div>

          <div class="detail">
            <strong>Payment Status:</strong>
            ${esc(data.paymentStatus)}
          </div>

          <div class="detail">
            <strong>Package:</strong>
            ${gift ? 'Gift Package' : 'Standard Package'}
          </div>
        </div>
      </section>
    </div>

    <section class="reference-card">
      <div>
        <div class="reference-title">
          ORDER REFERENCE / CODE 128
        </div>

        <div class="reference-number">
          ${esc(data.orderId)}
        </div>

        <svg id="barcode"></svg>

        <div class="muted">
          Store order barcode — Not courier AWB
        </div>
      </div>

      <div class="qr-area">
        <div id="qrcode"></div>
        SCAN ORDER ID
      </div>
    </section>

    <div class="section-title">
      PACKAGE CONTENTS
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:45px">#</th>
          <th>PRODUCT DESCRIPTION</th>
          <th style="width:65px">QTY</th>
        </tr>
      </thead>

      <tbody>
        ${itemRows || `
          <tr>
            <td colspan="3">
              No product details available
            </td>
          </tr>
        `}
      </tbody>
    </table>

    <div class="payment-summary">
      <div>
        ${isCod
          ? 'COD — AMOUNT TO COLLECT'
          : 'ORDER TOTAL — PREPAID'}
      </div>

      <div class="payment-total">
        ${money(data.total)}
      </div>
    </div>

    ${giftSection}

    <div class="note">
      <strong>PACKING INSTRUCTIONS:</strong>
      Verify the delivery address, product quantity
      and packaging before dispatch. Protect fragile
      products using appropriate cushioning.
      <strong>
        This is an internal packaging label, not a
        Shiprocket courier shipping label.
      </strong>
    </div>

    <footer class="footer">
      <span>${esc(BRAND)}</span>
      <span>PACKED WITH CARE</span>
    </footer>

  </main>

  <script>
    (function () {
      var orderReference = ${qrPayload};

      var printButton =
        document.getElementById('printBtn');

      var qrTarget =
        document.getElementById('qrcode');

      var barcodeTarget =
        document.getElementById('barcode');

      var ready = true;

      try {
        if (typeof JsBarcode !== 'function') {
          throw new Error('Barcode library unavailable');
        }

        JsBarcode(barcodeTarget, orderReference, {
          format: 'CODE128',
          displayValue: false,
          lineColor: '#251a14',
          height: 52,
          margin: 3,
          width: 1.3
        });
      } catch (error) {
        ready = false;

        barcodeTarget.replaceWith(
          document.createTextNode(
            'Barcode unavailable'
          )
        );
      }

      try {
        if (typeof QRCode !== 'function') {
          throw new Error('QR library unavailable');
        }

        new QRCode(qrTarget, {
          text: orderReference,
          width: 108,
          height: 108,
          colorDark: '#251a14',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.M
        });
      } catch (error) {
        ready = false;
        qrTarget.textContent =
          'QR code unavailable';
        qrTarget.className = 'scan-error';
      }

      printButton.addEventListener(
        'click',
        function () {
          if (!ready) {
            var continuePrint = window.confirm(
              'QR or barcode could not load. ' +
              'Print without scannable codes?'
            );

            if (!continuePrint) {
              return;
            }
          }

          window.print();
        }
      );
    })();
  </script>

</body>
</html>
    `;
  }


  /* ===================================
     PRINT LABEL
  =================================== */

  function printLabel(order) {
    const html = buildLabel(order);

    const blob = new Blob([html], {
      type: 'text/html'
    });

    const url = URL.createObjectURL(blob);

    const printWindow = window.open(
      url,
      '_blank'
    );

    if (!printWindow) {
      URL.revokeObjectURL(url);

      if (window.MC?.toast) {
        window.MC.toast(
          'Please allow the print popup.',
          'error'
        );
      } else {
        alert('Please allow the print popup.');
      }

      return;
    }

    /*
      Keep Blob URL available until
      the print preview has loaded.
    */

    printWindow.addEventListener(
      'load',
      () => {
        printWindow.focus();

        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 60000);
      },
      { once: true }
    );
  }


  /* ===================================
     INTERCEPT PRINT FOR ALL ORDERS

     Existing orders.js uses the
     .print-label button.

     Capture phase prevents duplicate
     windows from old click handlers.
  =================================== */

  function handlePrintClick(event) {
    const button = event.target.closest?.(
      '.print-label'
    );

    if (!button) return;

    const row = button.closest(
      'tr[id^="details-"]'
    );

    if (!row) return;

    const id = row.id.slice(
      'details-'.length
    );

    const order = findOrder(id);

    if (!order) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    printLabel(order);
  }


  /* ===================================
     INITIALIZE
  =================================== */

  function initialize() {
    const table = document.getElementById(
      'orders'
    );

    if (!table) return;

    installStyles();

    decorateRows();
    decorateGiftDetails();

    document.addEventListener(
      'click',
      handlePrintClick,
      true
    );

    const observer = new MutationObserver(
      () => {
        /*
          Disconnect before updating
          the DOM to avoid observer loops.
        */
        observer.disconnect();

        try {
          decorateRows();
          decorateGiftDetails();
        } finally {
          observer.observe(table, {
            childList: true,
            subtree: true
          });
        }
      }
    );

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
