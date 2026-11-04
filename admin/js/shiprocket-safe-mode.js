
'use strict';

/*
=========================================
 MEMORA CREATIONS
 SHIPROCKET SAFE MODE UI V1

 - Reads actual backend safe mode
 - Shows Safe Mode ON/OFF
 - Blocks live shipment UI when safe
 - Keeps Dry Run available
 - Keeps Courier Rates available
 - Fails closed if API cannot be read

 Backend is the final security layer.
=========================================
*/

(() => {

  const API_PATH = '/admin/shiprocket/safe-mode';

  let liveEnabled = false;
  let statusKnown = false;

  function element(tag, text) {
    const node = document.createElement(tag);

    if (text !== undefined) {
      node.textContent = text;
    }

    return node;
  }

  function getShipmentForms() {
    return document.querySelectorAll(
      'form.shipment-form'
    );
  }

  function makeStatusPanel(form) {
    const parent = form.parentElement;

    if (!parent) return null;

    let panel = parent.querySelector(
      '.mc-safe-mode-panel'
    );

    if (panel) return panel;

    panel = element('div');

    panel.className = 'mc-safe-mode-panel';

    panel.style.cssText = [
      'padding:14px',
      'margin:14px 0',
      'border:1px solid #f0d7a0',
      'border-radius:12px',
      'background:#fff8e8',
      'color:#624514',
      'font-weight:600',
      'line-height:1.6'
    ].join(';');

    form.insertAdjacentElement(
      'beforebegin',
      panel
    );

    return panel;
  }

  function updateForm(form) {
    const button = form.querySelector(
      '.create-shipment'
    );

    const panel = makeStatusPanel(form);

    if (!panel) return;

    if (!statusKnown) {
      panel.textContent =
        'Checking Shiprocket Safe Mode...';
    } else if (liveEnabled) {
      panel.textContent =
        'LIVE MODE ON — Real shipment creation ' +
        'is enabled on the backend.';
    } else {
      panel.textContent =
        'SAFE MODE ON — Real shipment and AWB ' +
        'creation are disabled. Use Test ' +
        'Shipment (Dry Run).';
    }

    panel.style.background =
      statusKnown && liveEnabled
        ? '#fff0ed'
        : '#fff8e8';

    if (button && !liveEnabled) {
      if (!button.disabled) {
        button.disabled = true;
      }

      if (
        button.textContent !==
        'Live Shipment Disabled (Safe Mode)'
      ) {
        button.textContent =
          'Live Shipment Disabled (Safe Mode)';
      }
    }
  }

  function updateAllForms() {
    for (const form of getShipmentForms()) {
      updateForm(form);
    }
  }

  /*
    Prevent clicks and form submission
    while Live Mode is not confirmed.
    Backend additionally blocks this.
  */

  document.addEventListener(
    'click',
    event => {
      const button = event.target.closest(
        '.create-shipment'
      );

      if (!button || liveEnabled) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      updateAllForms();

    },
    true
  );

  document.addEventListener(
    'submit',
    event => {
      const form = event.target;

      if (
        !form.matches?.('form.shipment-form') ||
        liveEnabled
      ) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      updateForm(form);

    },
    true
  );

  /*
    The original Orders script may
    enable the button after it loads
    courier rates.

    Watch for newly rendered forms and
    button updates, then lock it again.
  */

  let updating = false;

  const observer = new MutationObserver(() => {
    if (updating) return;

    updating = true;

    try {
      updateAllForms();
    } finally {
      updating = false;
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['disabled']
  });

  /*
    Only the authenticated admin
    can read this backend status.

    An API error is treated as
    Safe Mode ON in the UI.
  */

  async function loadSafeMode() {
    statusKnown = false;
    liveEnabled = false;

    updateAllForms();

    try {
      if (!window.MC?.api) {
        throw new Error('API unavailable.');
      }

      const data = await window.MC.api(
        API_PATH
      );

      if (
        data?.success !== true ||
        typeof data.liveShipmentEnabled !==
          'boolean'
      ) {
        throw new Error(
          'Invalid Safe Mode response.'
        );
      }

      liveEnabled =
        data.liveShipmentEnabled === true;

      statusKnown = true;

    } catch (error) {
      console.warn(
        '[Shiprocket Safe Mode]',
        error.message
      );

      liveEnabled = false;
      statusKnown = false;
    }

    updateAllForms();
  }

  loadSafeMode();

})();
