/*
  MEMORA CREATIONS - ORDER INVOICE (BILL)

  Adds a "Download Invoice" button to the order details page. It
  opens a clean bill in a new window and starts printing, where the
  customer can choose "Save as PDF". The bill is built in the browser
  from the order the customer already sees, nothing new is stored.

  The bill itself (numbered, with GST when enabled in Store Settings) is
  built by the server and drawn by invoice-render.js.
*/
(() => {

  function openInvoice() {
    // currentOrderDetails is set by order-details.js
    const order =
      typeof currentOrderDetails !== 'undefined' ? currentOrderDetails : null;

    if (!order || !window.MCInvoice) return;

    // The numbered bill / GST invoice is built by the server.
    window.MCInvoice.open(order._id, '/orders/');
  }

  function addButton() {
    const hero = document.querySelector('.order-status-hero');

    if (!hero || hero.querySelector('.mc-invoice-btn')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mc-invoice-btn';
    button.textContent = '🧾 Download Invoice';
    button.style.cssText =
      'margin-top:12px;padding:10px 16px;border:1px solid #8a5a3b;border-radius:999px;' +
      'background:#fff;color:#8a5a3b;font:inherit;font-weight:700;font-size:13px;cursor:pointer';
    button.addEventListener('click', openInvoice);

    (hero.firstElementChild || hero).appendChild(button);
  }

  function start() {
    const box = document.querySelector('#order');

    if (!box) return;

    new MutationObserver(addButton).observe(box, { childList: true, subtree: true });
    addButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

})();
