
/*
  MEMORA CREATIONS
  DELIVERY ESTIMATE - SAFE VERSION 2

  Features:
  - Checkout PIN Code auto-fill detection
  - Manual PIN Code updates
  - Order Success delivery estimate
  - No changes to orders, payments or stock
  - No invented delivery promises
*/

(() => {
  "use strict";

  const VERIFIED_PIN_WINDOWS = {
    // Add only verified delivery windows.
    // Example:
    // "274305": { minDays: 4, maxDays: 7 }
  };

  const INDIA_TIMEZONE = "Asia/Kolkata";

  function validPin(pin) {
    return /^\d{6}$/.test(
      String(pin || "").trim()
    );
  }

  function formatIndiaDate(date) {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC"
    }).format(date);
  }

  function indiaCalendarDate(value) {
    const source = new Date(value);

    if (!Number.isFinite(source.getTime())) {
      return null;
    }

    const parts = new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: INDIA_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }
    ).formatToParts(source);

    const get = type =>
      Number(
        parts.find(p => p.type === type)?.value
      );

    const year = get("year");
    const month = get("month");
    const day = get("day");

    return new Date(
      Date.UTC(year, month - 1, day)
    );
  }

  function addDays(date, days) {
    const result = indiaCalendarDate(date);

    if (!result) return null;

    result.setUTCDate(
      result.getUTCDate() + days
    );

    return result;
  }

  function getEstimate(pin, orderDate) {
    const code = String(pin || "").trim();

    if (!validPin(code)) {
      return {
        message: "Enter a valid 6-digit PIN Code.",
        available: false
      };
    }

    const window = VERIFIED_PIN_WINDOWS[code];

    if (!window) {
      return {
        message:
          "Delivery date will be confirmed " +
          "after courier serviceability check.",
        available: false
      };
    }

    const min = Number(window.minDays);
    const max = Number(window.maxDays);

    if (
      !Number.isInteger(min) ||
      !Number.isInteger(max) ||
      min < 1 ||
      max < min ||
      max > 60
    ) {
      return {
        message:
          "Delivery estimate is currently unavailable.",
        available: false
      };
    }

    const start = addDays(orderDate, min);
    const end = addDays(orderDate, max);

    if (!start || !end) {
      return {
        message: "Delivery date unavailable.",
        available: false
      };
    }

    return {
      available: true,
      message:
        "Expected Delivery: " +
        formatIndiaDate(start) +
        " - " +
        formatIndiaDate(end)
    };
  }

  function createPanel() {
    const panel = document.createElement("section");

    panel.id = "mcDeliveryEstimate";

    panel.style.cssText = [
      "margin:18px 0",
      "padding:18px",
      "border:1px solid #e7d8c8",
      "border-radius:14px",
      "background:#fffaf5",
      "color:#34251c"
    ].join(";");

    const heading = document.createElement("h3");
    heading.textContent = "Estimated Delivery";

    const result = document.createElement("p");
    result.className = "mc-estimate-result";
    result.setAttribute("aria-live", "polite");

    const note = document.createElement("small");
    note.textContent =
      "Delivery dates are estimates, not guarantees.";

    panel.append(heading, result, note);

    return panel;
  }

  function updatePanel(panel, pin, date) {
    const result = panel.querySelector(
      ".mc-estimate-result"
    );

    if (!result) return;

    const estimate = getEstimate(pin, date);

    result.textContent = estimate.message;
  }

  function initializeCheckout() {
    const pinInput =
      document.getElementById("pinCode");

    const form =
      document.getElementById("checkoutForm");

    if (!pinInput || !form) return;

    let panel =
      document.getElementById("mcDeliveryEstimate");

    if (!panel) {
      panel = createPanel();

      pinInput.insertAdjacentElement(
        "afterend",
        panel
      );
    }

    let lastPin = null;

    function update(force = false) {
      const currentPin = String(
        pinInput.value || ""
      ).trim();

      if (!force && currentPin === lastPin) {
        return;
      }

      lastPin = currentPin;

      updatePanel(
        panel,
        currentPin,
        new Date()
      );
    }

    pinInput.addEventListener(
      "input",
      () => update(true)
    );

    pinInput.addEventListener(
      "change",
      () => update(true)
    );

    window.addEventListener(
      "pageshow",
      () => update(true)
    );

    update(true);

    // Detect asynchronous saved-address filling.
    // This only reads the PIN and updates the UI.
    const startedAt = Date.now();

    const watcher = setInterval(() => {
      update();

      if (Date.now() - startedAt >= 20000) {
        clearInterval(watcher);
      }
    }, 250);

    window.addEventListener(
      "pagehide",
      () => clearInterval(watcher),
      { once: true }
    );
  }

  async function initializeOrderSuccess() {
    const holder =
      document.getElementById("orderSuccess");

    const orderId = new URLSearchParams(
      location.search
    ).get("id");

    if (!holder || !orderId || !window.MC?.api) {
      return;
    }

    try {
      const data = await window.MC.api(
        "/orders/" + encodeURIComponent(orderId)
      );

      const order = data.order;

      if (!order) return;

      const panel = createPanel();

      updatePanel(
        panel,
        order.shippingAddress?.pinCode,
        order.createdAt
      );

      function insert() {
        const card =
          holder.querySelector(".success-card");

        if (!card) return false;

        if (
          !document.getElementById(
            "mcDeliveryEstimate"
          )
        ) {
          card.appendChild(panel);
        }

        return true;
      }

      if (insert()) return;

      const observer = new MutationObserver(() => {
        if (insert()) observer.disconnect();
      });

      observer.observe(holder, {
        childList: true,
        subtree: true
      });

      setTimeout(
        () => observer.disconnect(),
        15000
      );

    } catch (error) {
      console.warn(
        "Delivery estimate unavailable:",
        error.message
      );
    }
  }

  function initialize() {
    const path = location.pathname;

    if (path.endsWith("/checkout.html")) {
      initializeCheckout();
    }

    if (path.endsWith("/order-success.html")) {
      initializeOrderSuccess();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }
})();
