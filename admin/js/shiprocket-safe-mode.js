
'use strict';

/*
=========================================
 MEMORA CREATIONS
 SHIPROCKET SAFE MODE UI V2

 - Reads real backend safe-mode status
 - Shows Safe Mode ON / Live Mode ON
 - Disables real shipment creation
 - Allows Dry Run and courier checks
 - Blocks forms while status is unknown
 - Avoids MutationObserver update loops

 SECURITY:
 Backend authorization is authoritative.
=========================================
*/

(() => {
  const API_PATH = '/admin/shiprocket/safe-mode';

  let liveEnabled = false;
  let statusKnown = false;

  function makeElement(tag, text) {
    const element = document.createElement(tag);

    if (text !== undefined) {
      element.textContent = String(text);
    }

    return element;
  }

  function setTextIfChanged(node, value) {
    if (node && node.textContent !== value) {
      node.textContent = value;
    }
  }

  function getShipmentForms() {
    return document.querySelectorAll(
      'form.shipment-form'
    );
  }

  function ensureStatusPanel(form) {
    const parent = form.parentElement;

    if (!parent) {
      return null;
    }

    let panel = parent.querySelector(
      '.mc-safe-mode-panel'
    );

    if (panel) {
      return panel;
    }

    panel = makeElement('div');

    panel.className = 'mc-safe-mode-panel';

    panel.setAttribute('role', 'status');

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
    const panel = ensureStatusPanel(form);

    if (!panel) {
      return;
    }

    const liveButton = form.querySelector(
      '.create-shipment'
    );

    let message;

    if (!statusKnown) {
      message =
        'SHIPROCKET SAFE MODE — ' +
        'Verifying backend status. ' +
        'Real shipment creation is unavailable.';
    } else if (liveEnabled) {
      message =
        'LIVE MODE ON — Real Shiprocket ' +
        'shipment creation is enabled. ' +
        'Only use this when sending a parcel.';
    } else {
      message =
        'SAFE MODE ON — Real shipment ' +
        'and AWB creation are disabled. ' +
        'Use Test Shipment (Dry Run).';
    }

    setTextIfChanged(panel, message);

    const background =
      statusKnown && liveEnabled
        ? '#fff0ed'
        : '#fff8e8';

    if (panel.style.background !== background) {
      panel.style.background = background;
    }

    if (!liveButton) {
      return;
    }

    if (!statusKnown || !liveEnabled) {
      if (!liveButton.disabled) {
        liveButton.disabled = true;
      }

      const buttonLabel = statusKnown
        ? 'Live Shipment Disabled (Safe Mode)'
        : 'Checking Shipment Safe Mode...';

      setTextIfChanged(
        liveButton,
        buttonLabel
      );

      liveButton.dataset.mcSafeModeLocked =
        'true';

      return;
    }

    /*
      In Live Mode, the original
      Orders script controls this
      button. Courier selection and
      order eligibility must still
      be checked before enabling it.
    */

    if (
      liveButton.dataset.mcSafeModeLocked ===
      'true'
    ) {
      delete liveButton.dataset.mcSafeModeLocked;

      setTextIfChanged(
        liveButton,
        'Create Shipment + AWB'
      );

      /*
        Do not automatically enable:
        the original Orders script
        enables after courier checks.
      */
    }
  }

  function updateAllForms() {
    getShipmentForms().forEach(updateForm);
  }

  /*
    Capture clicks and submissions
    before the original Orders script
    handles them.
  */

  document.addEventListener(
    'click',
    event => {
      const button = event.target.closest?.(
        '.create-shipment'
      );

      if (!button || (statusKnown && liveEnabled)) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      const form = button.closest(
        'form.shipment-form'
      );

      if (form) {
        updateForm(form);
      }
    },
    true
  );

  document.addEventListener(
    'submit',
    event => {
      const form = event.target;

      if (
        !form.matches?.('form.shipment-form') ||
        (statusKnown && liveEnabled)
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
    New order-detail forms are inserted
    dynamically.

    Only update text if it has changed.
    This prevents repeated mutations
    and observer feedback loops.
  */

  let isUpdating = false;

  const observer = new MutationObserver(() => {
    if (isUpdating) {
      return;
    }

    isUpdating = true;

    try {
      updateAllForms();
    } finally {
      isUpdating = false;
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['disabled']
  });

  /*
    The backend is the source of truth.

    A failed or invalid response does
    not permit live shipment creation.
  */

  async function loadSafeMode() {
    liveEnabled = false;
    statusKnown = false;

    updateAllForms();

    try {
      if (!window.MC?.api) {
        throw new Error(
          'Admin API is unavailable.'
        );
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
