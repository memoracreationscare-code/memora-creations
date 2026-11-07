/*
  Adds an "Export CSV" button to the admin Orders page.
  The file opens in Excel / Google Sheets and is useful for
  accounts, GST filing and keeping your own records.
  It exports the orders that match the current search box.
*/
(() => {

  const HEADERS = [
    'Order ID', 'Date', 'Customer', 'Mobile', 'Address', 'City', 'State',
    'PIN', 'Products', 'Subtotal', 'Delivery', 'Discount', 'Total',
    'Payment method', 'Payment status', 'Order status'
  ];

  // Stops spreadsheet formulas from running if a name starts with = + - @
  function cell(value) {
    let text = String(value ?? '');

    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;

    return '"' + text.replace(/"/g, '""') + '"';
  }

  function rowOf(order) {
    const address = order.shippingAddress || {};

    const products = (order.items || [])
      .map(item => `${item.name} x${item.quantity}`)
      .join('; ');

    return [
      order.orderId,
      order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN') : '',
      address.fullName,
      address.mobile,
      address.addressLine,
      address.city,
      address.state,
      address.pinCode,
      products,
      order.subtotal,
      order.deliveryCharge,
      order.couponDiscount || order.discount || 0,
      order.grandTotal,
      order.paymentMethod,
      order.paymentStatus,
      order.orderStatus
    ].map(cell).join(',');
  }

  async function exportOrders(button) {
    const search = document.querySelector('#search')?.value || '';

    button.disabled = true;
    button.textContent = 'Preparing...';

    try {
      const data = await window.MC.api(
        '/admin/orders?search=' + encodeURIComponent(search)
      );

      const orders = Array.isArray(data.orders) ? data.orders : [];

      if (!orders.length) {
        window.MC.toast('No orders to export.', 'error');
        return;
      }

      const csv =
        '﻿' + [HEADERS.map(cell).join(','), ...orders.map(rowOf)].join('\r\n');

      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');

      link.href = url;
      link.download = 'memora-orders-' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      window.MC.toast(orders.length + ' orders exported.', 'success');

    } catch (error) {
      window.MC.toast(error.message || 'Export failed.', 'error');

    } finally {
      button.disabled = false;
      button.textContent = 'Export CSV';
    }
  }

  function start() {
    const searchButton = document.querySelector('#searchBtn');

    if (!searchButton || document.querySelector('#exportOrdersBtn')) return;

    const button = document.createElement('button');
    button.id = 'exportOrdersBtn';
    button.type = 'button';
    button.textContent = 'Export CSV';
    button.className = searchButton.className;
    button.style.cssText = 'margin-left:8px;background:#1f9d55;color:#fff;border:0;border-radius:12px;padding:10px 16px;font-weight:700;cursor:pointer';
    button.addEventListener('click', () => exportOrders(button));

    searchButton.insertAdjacentElement('afterend', button);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

})();
