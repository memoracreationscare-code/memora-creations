
/*
=========================================
 MEMORA CREATIONS
 SHIPROCKET DRY RUN - VERSION 1

 SAFE ADMIN SHIPMENT TESTING

 - Adds Dry Run button
 - Checks package details
 - Calls dry-run endpoint only
 - Shows available couriers
 - Shows estimated shipping charges
 - Shows courier ETD

 DOES NOT:
 - Create a shipment
 - Generate an AWB
 - Schedule a pickup
 - Change payments or stock
=========================================
*/

(() => {
  'use strict';

  const FORM_SELECTOR = '.shipment-form';

  const ORDER_ID_PATTERN = /^[a-f0-9]{24}$/i;

  function make(tag, text, className) {
    const element = document.createElement(tag);

    if (text !== undefined) {
      element.textContent = String(text);
    }

    if (className) {
      element.className = className;
    }

    return element;
  }

  function money(value) {
    const number = Number(value);

    if (!Number.isFinite(number) || number < 0) {
      return 'Not available';
    }

    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(number);
  }

  function addLine(parent, label, value) {
    const row = make('p');

    row.style.margin = '6px 0';

    const title = make(
      'strong',
      label + ': '
    );

    const details = make(
      'span',
      value === null ||
      value === undefined ||
      value === ''
        ? 'Not available'
        : value
    );

    row.append(title, details);
    parent.appendChild(row);
  }

  function getPayload(form) {
    const payload = Object.fromEntries(
      new FormData(form)
    );

    payload.width =
      payload.width ?? payload.breadth;

    delete payload.breadth;

    /*
      This endpoint validates the package
      on the backend as well.
    */

    return payload;
  }

  function getOrderId(form) {
    const row = form.closest(
      'tr[id^="details-"]'
    );

    if (!row) return null;

    const id = row.id.slice(
      'details-'.length
    );

    return ORDER_ID_PATTERN.test(id)
      ? id
      : null;
  }

  function ensureDryRunButton(form) {
    if (
      form.querySelector(
        '.mc-shiprocket-dry-run'
      )
    ) {
      return;
    }

    const checkButton = form.querySelector(
      '.check-couriers'
    );

    if (!checkButton) {
      return;
    }

    const button = make(
      'button',
      'Test Shipment (Dry Run)',
      'btn secondary mc-shiprocket-dry-run'
    );

    button.type = 'button';

    button.style.cssText = [
      'background:#eef5ff',
      'color:#164e83',
      'border:1px solid #b8d4f4',
      'font-weight:700'
    ].join(';');

    checkButton.insertAdjacentElement(
      'beforebegin',
      button
    );

    const output = make(
      'div',
      '',
      'mc-dry-run-result'
    );

    output.style.cssText = [
      'margin-top:15px',
      'padding:12px',
      'border-radius:12px',
      'border:1px solid #d9e5f2',
      'background:#f6faff',
      'display:none',
      'overflow-wrap:anywhere'
    ].join(';');

    const existingResults =
      form.querySelector('.courier-results');

    if (existingResults) {
      existingResults.insertAdjacentElement(
        'beforebegin',
        output
      );
    } else {
      form.appendChild(output);
    }
  }

  function displayResult(output, data) {
    output.replaceChildren();

    const title = make(
      'h3',
      'Shiprocket Dry Run Result'
    );

    output.appendChild(title);

    const notice = make(
      'p',
      'TEST ONLY — No shipment, AWB or pickup created.'
    );

    notice.style.fontWeight = '700';
    output.appendChild(notice);

    addLine(
      output,
      'Order',
      data.orderId
    );

    addLine(
      output,
      'Pickup PIN',
      data.pickupPincode
    );

    addLine(
      output,
      'Delivery PIN',
      data.deliveryPincode
    );

    addLine(
      output,
      'Payment Method',
      data.paymentMethod
    );

    addLine(
      output,
      'Couriers Available',
      data.courierCount
    );

    const couriers = Array.isArray(
      data.couriers
    )
      ? data.couriers
      : [];

    if (!couriers.length) {
      output.appendChild(
        make(
          'p',
          'No eligible courier found for this package.'
        )
      );

      return;
    }

    const heading = make(
      'h4',
      'Courier Options'
    );

    heading.style.marginTop = '16px';

    output.appendChild(heading);

    for (const courier of couriers) {
      const card = make('div');

      card.style.cssText = [
        'padding:12px',
        'margin-top:10px',
        'border:1px solid #d6e1ed',
        'border-radius:10px',
        'background:white'
      ].join(';');

      const name = make(
        'strong',
        courier.courierName || 'Courier'
      );

      card.appendChild(name);

      addLine(
        card,
        'Shipping Charge',
        money(courier.rate)
      );

      if (data.paymentMethod === 'COD') {
        addLine(
          card,
          'COD Charge',
          money(courier.codCharges)
        );
      }

      addLine(
        card,
        'Estimated Delivery',
        courier.estimatedDeliveryDate ||
        'Not supplied by Shiprocket'
      );

      output.appendChild(card);
    }

    const disclaimer = make(
      'small',
      'Rates and dates are estimates. ' +
      'Actual shipment charges may differ.'
    );

    disclaimer.style.display = 'block';
    disclaimer.style.marginTop = '12px';

    output.appendChild(disclaimer);
  }

  async function runDryRun(button, form) {
    if (button.disabled) return;

    if (!form.reportValidity()) {
      return;
    }

    const orderId = getOrderId(form);

    if (!orderId) {
      return;
    }

    const output = form.querySelector(
      '.mc-dry-run-result'
    );

    if (!output) return;

    if (!window.MC?.api) {
      output.style.display = 'block';
      output.textContent =
        'API is not available. Please refresh.';
      return;
    }

    const originalLabel = button.textContent;

    button.disabled = true;
    button.textContent = 'Running Safe Test...';

    output.style.display = 'block';

    output.textContent =
      'Checking couriers without creating a shipment...';

    try {
      const payload = getPayload(form);

      const data = await window.MC.api(
        '/admin/orders/' +
        encodeURIComponent(orderId) +
        '/shipment-dry-run',
        {
          method: 'POST',
          body: JSON.stringify(payload)
        }
      );

      if (
        !data ||
        data.success !== true ||
        data.dryRun !== true ||
        data.shipmentCreated !== false ||
        data.awbGenerated !== false ||
        data.pickupBooked !== false
      ) {
        throw new Error(
          'Unexpected dry-run response.'
        );
      }

      displayResult(output, data);

    } catch (error) {
      output.replaceChildren();

      output.appendChild(
        make(
          'p',
          error.message ||
          'Dry run failed. Please try again.'
        )
      );

    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }

  /*
    Existing Orders script renders the
    shipment form after View Details.

    This script adds the Dry Run button
    without replacing Orders logic.
  */

  document.addEventListener(
    'click',
    event => {

      const viewButton = event.target.closest(
        '.view-order'
      );

      if (viewButton) {
        queueMicrotask(() => {
          const orderId =
            viewButton.dataset.id;

          if (
            !orderId ||
            !ORDER_ID_PATTERN.test(orderId)
          ) {
            return;
          }

          const row = document.getElementById(
            'details-' + orderId
          );

          const form = row?.querySelector(
            FORM_SELECTOR
          );

          if (form) {
            ensureDryRunButton(form);
          }
        });

        return;
      }

      const dryRunButton =
        event.target.closest(
          '.mc-shiprocket-dry-run'
        );

      if (!dryRunButton) return;

      const form = dryRunButton.closest(
        FORM_SELECTOR
      );

      if (!form) return;

      event.preventDefault();

      runDryRun(
        dryRunButton,
        form
      );
    }
  );

})();
