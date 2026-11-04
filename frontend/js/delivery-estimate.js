
/*
 MEMORA CREATIONS
 ESTIMATED DELIVERY DATE

 Safe for Checkout and Order Success
 No payment or stock changes
*/

(() => {
  "use strict";

  // Add only courier-verified PIN delivery windows.
  // Days are calendar days after order placement.
  const VERIFIED_PIN_WINDOWS = {

    // Example format only:
    // "274304": { minDays: 4, maxDays: 7 },

  };

  const API =
    "https://memora-creations.onrender.com/api";

  function validPin(pin) {
    return /^\d{6}$/.test(String(pin || "").trim());
  }

  function addDays(date, days) {
    const source = new Date(date);

    if (!Number.isFinite(source.getTime())) {
      return null;
    }

    const indiaDate = new Date(
      source.getTime() + 330 * 60000
    );

    const result = new Date(Date.UTC(
      indiaDate.getUTCFullYear(),
      indiaDate.getUTCMonth(),
      indiaDate.getUTCDate()
    ));

    result.setUTCDate(
      result.getUTCDate() + days
    );

    return result;
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC"
    }).format(date);
  }

  function estimateDelivery(pin, orderDate) {
    const code = String(pin || "").trim();

    if (!validPin(code)) {
      return null;
    }

    const range = VERIFIED_PIN_WINDOWS[code];

    if (!range) {
      return null;
    }

    const min = Number(range.minDays);
    const max = Number(range.maxDays);

    if (
      !Number.isInteger(min) ||
      !Number.isInteger(max) ||
      min < 1 ||
      max < min ||
      max > 60
    ) {
      return null;
    }

    const first = addDays(orderDate, min);
    const last = addDays(orderDate, max);

    if (!first || !last) {
      return null;
    }

    return (
      formatDate(first) +
      " - " +
      formatDate(last)
    );
  }

  function createPanel() {
    const panel = document.createElement("div");

    panel.id = "mcDeliveryEstimate";

    panel.style.cssText = [
      "margin:18px 0",
      "padding:18px",
      "border:1px solid #e7d8c8",
      "border-radius:14px",
      "background:#fffaf5",
      "color:#34251c"
    ].join(";");

    const title = document.createElement("h3");
    title.textContent = "Estimated Delivery";

    const result = document.createElement("p");
    result.className = "mc-estimate-result";
    result.setAttribute("aria-live", "polite");

    const note = document.createElement("small");
    note.textContent =
      "Delivery dates are estimates, not guarantees.";

    panel.append(title, result, note);

    return panel;
  }

  function showEstimate(panel, pin, date) {
    const result = panel.querySelector(
      ".mc-estimate-result"
    );

    if (!result) return;

    const estimated = estimateDelivery(pin, date);

    if (estimated) {
      result.textContent =
        "Expected Delivery: " + estimated;
    } else if (validPin(pin)) {
      result.textContent =
        "Delivery date will be confirmed " +
        "after courier serviceability check.";
    } else {
      result.textContent =
        "Enter a valid 6-digit PIN Code.";
    }
  }

  function checkoutEstimate() {
    const pinInput =
      document.getElementById("pinCode");

    if (!pinInput) return;

    const form =
      document.getElementById("checkoutForm");

    if (!form) return;

    const panel = createPanel();

    const summary = form.querySelector("#summary");

    if (summary) {
      summary.insertAdjacentElement(
        "afterend",
        panel
      );
    } else {
      pinInput.insertAdjacentElement(
        "afterend",
        panel
      );
    }

    function update() {
      showEstimate(
        panel,
        pinInput.value,
        new Date()
      );
    }

    pinInput.addEventListener("input", update);
    pinInput.addEventListener("change", update);

    update();
  }

  async function successEstimate() {
    const holder =
      document.getElementById("orderSuccess");

    const id = new URLSearchParams(
      location.search
    ).get("id");

    if (!holder || !id) return;

    try {
      if (!window.MC?.api) return;

      const response = await window.MC.api(
        "/orders/" + encodeURIComponent(id)
      );

      const order = response.order;

      if (!order) return;

      const panel = createPanel();

      showEstimate(
        panel,
        order.shippingAddress?.pinCode,
        order.createdAt
      );

      function insertPanel() {
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

      if (insertPanel()) return;

      const observer = new MutationObserver(() => {
        if (insertPanel()) observer.disconnect();
      });

      observer.observe(holder, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
      }, 15000);

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
      checkoutEstimate();
    }

    if (path.endsWith("/order-success.html")) {
      successEstimate();
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
