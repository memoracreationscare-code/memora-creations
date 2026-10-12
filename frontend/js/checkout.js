
/* MEMORA CREATIONS — Cashfree + COD checkout
   Replace frontend/js/checkout.js with this entire file.
   Requires checkout.html to load app.js and Cashfree SDK v3.
*/
(() => {
  'use strict';

  const BASE = '/memora-creations';
  const MC = window.MC;
  if (!MC) {
    console.error('app.js must load before checkout.js');
    return;
  }

  let items = [];
  let user = null;
  let fromCart = false;
  let submitting = false;

  const $ = (selector) => document.querySelector(selector);

  function message(text, type = 'error') {
    MC.toast(text, type);
  }

  function setLoading(value) {
    submitting = value;
    const button = $('#checkoutForm button[type="submit"]');
    if (button) {
      button.disabled = value;
      button.innerHTML = value
        ? 'Please wait...'
        : 'Place Order / Pay <span>→</span>';
    }
  }

  function addressData() {
    const value = (id) => ($(`#${id}`)?.value || '').trim();
    return {
      fullName: value('fullName'),
      mobile: value('mobile'),
      addressLine: value('addressLine'),
      pinCode: value('pinCode'),
      city: value('city'),
      state: value('state')
    };
  }

  function validateAddress() {
    const a = addressData();
    if (!a.fullName) return message('Full Name required hai.'), false;
    if (!/^[6-9]\d{9}$/.test(a.mobile)) {
      return message('Valid 10 digit mobile number dalo.'), false;
    }
    if (!a.addressLine) return message('Full address required hai.'), false;
    if (!/^\d{6}$/.test(a.pinCode)) {
      return message('Valid 6 digit PIN Code dalo.'), false;
    }
    return true;
  }

  function orderUrl(id) {
    return `${BASE}/frontend/order-success.html?id=${encodeURIComponent(id)}`;
  }

  function showConfirmation(title, description, orderId) {
    $('#checkoutSuccessPopup')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'checkoutSuccessPopup';
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;' +
      'justify-content:center;padding:20px;background:rgba(24,15,10,.68)';
    const panel = document.createElement('div');
    panel.style.cssText =
      'width:min(430px,94vw);padding:32px 24px;border-radius:22px;' +
      'background:#fffaf6;text-align:center;color:#2b1b12';
    const heading = document.createElement('h2');
    heading.textContent = title;
    const detail = document.createElement('p');
    detail.textContent = description;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'View Order';
    button.style.cssText =
      'cursor:pointer;width:100%;padding:15px;border:0;border-radius:30px;' +
      'background:#8a5a3b;color:white;font-weight:700';
    button.addEventListener('click', () => {
      location.href = orderUrl(orderId);
    });
    panel.append(heading, detail, button);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  function populateAddress() {
    const addresses = Array.isArray(user?.addresses) ? user.addresses : [];
    const saved = addresses.find((a) => a.isDefault) || addresses[0] || {};
    for (const field of ['fullName', 'mobile', 'addressLine',
      'pinCode', 'city', 'state']) {
      const element = $(`#${field}`);
      if (element) element.value = saved[field] || user?.[field] || '';
    }
  }

  function drawSummary(preview) {
    const summary = $('#summary');
    if (!summary) return;
    summary.replaceChildren();

    const line = (label, amount, isTotal = false) => {
      const row = document.createElement('div');
      row.className = isTotal ? 'summaryline total' : 'summaryline';
      const left = document.createElement('span');
      left.textContent = label;
      const right = document.createElement('b');
      right.textContent = MC.money(amount);
      row.append(left, right);
      summary.appendChild(row);
    };

    for (const item of preview.items || []) {
      line(`${item.name || 'Product'} × ${Number(item.quantity || 1)}`,
        item.lineTotal);
    }
    line('Delivery', preview.deliveryCharge);
    line('You Save', preview.discount);
    line('Total', preview.grandTotal, true);
  }

  async function initialize() {
    user = await MC.requireLogin();
    if (!user) return;

    const params = new URLSearchParams(location.search);
    const buyNowId = params.get('buyNow');

    if (buyNowId) {
      fromCart = false;
      const qty = Number(params.get('qty') || 1);
      items = [{
        productId: buyNowId,
        quantity: Number.isFinite(qty)
          ? Math.min(99, Math.max(1, Math.floor(qty))) : 1
      }];
    } else {
      fromCart = true;
      const cart = await MC.api('/cart');
      items = (cart.cart?.items || [])
        .filter((x) => x.product?._id)
        .map((x) => ({
          productId: x.product._id,
          quantity: Number(x.quantity) || 1
        }));
    }

    if (!items.length) {
      $('#checkout').innerHTML =
        '<div class="empty">Cart is empty.</div>';
      return;
    }

    const preview = await MC.api('/orders/preview', {
      method: 'POST',
      body: JSON.stringify({ items })
    });

    drawSummary(preview);
    populateAddress();
  }

  function payload() {
    return {
      items,
      address: addressData(),
      clearCart: fromCart
    };
  }

  async function placeCodOrder() {
    setLoading(true);
    try {
      const data = await MC.api('/orders/cod', {
        method: 'POST',
        body: JSON.stringify(payload())
      });
      if (!data.order?._id) {
        throw new Error('Order bana, lekin order ID nahi mila.');
      }
      showConfirmation(
        'Order Placed Successfully',
        'Aapka Cash on Delivery order confirm ho gaya hai.',
        data.order._id
      );
    } catch (e) {
      message(e.message || 'COD order place nahi hua.');
    } finally {
      setLoading(false);
    }
  }

  async function placeCashfreeOrder() {
    setLoading(true);
    let orderId = null;

    try {
      if (typeof window.Cashfree !== 'function') {
        throw new Error('Cashfree SDK load nahi hua. Page refresh karein.');
      }

      const created = await MC.api('/cashfree/create-order', {
        method: 'POST',
        body: JSON.stringify(payload())
      });

      orderId = created.orderId;

      if (!created.paymentSessionId || !orderId) {
        throw new Error('Cashfree payment session nahi mila.');
      }

      const cashfree = window.Cashfree({
        mode: created.mode === 'production' ? 'production' : 'sandbox'
      });

      // Modal checkout keeps the user on this page. SDK completion is
      // NOT proof of successful payment.
      const result = await cashfree.checkout({
        paymentSessionId: created.paymentSessionId,
        redirectTarget: '_modal'
      });

      if (result?.redirect) {
        message('Payment redirect ho raha hai. Order status check karein.',
          'message');
        return;
      }

      // Even if the customer closed the modal, check the gateway's
      // authoritative status to avoid falsely reporting payment failure.
      const verified = await MC.api('/cashfree/verify', {
        method: 'POST',
        body: JSON.stringify({ orderId })
      });

      if (verified.verified === true &&
          verified.paymentStatus === 'SUCCESS' &&
          verified.order?._id) {
        showConfirmation(
          'Payment Successful',
          'Cashfree ne payment confirm kar diya hai.',
          verified.order._id
        );
        return;
      }

      message(
        result?.error?.message ||
        'Payment abhi confirm nahi hua. My Orders me status dekhein.',
        'message'
      );
    } catch (e) {
      // Network/verification errors do not prove that payment failed.
      message(
        orderId
          ? 'Payment confirm nahi ho paya. Dubara pay karne se pehle My Orders check karein.'
          : (e.message || 'Online payment start nahi hua.')
      );
    } finally {
      setLoading(false);
    }
  }

  const form = $('#checkoutForm');
  if (form) {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (submitting) return;
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      if (!$('#terms')?.checked) {
        message('Please accept order confirmation.');
        return;
      }
      if (!validateAddress()) return;

      const method = $('input[name="paymentMethod"]:checked')?.value;
      if (method === 'COD') {
        await placeCodOrder();
      } else if (method === 'CASHFREE') {
        await placeCashfreeOrder();
      } else {
        message('Payment method select karein.');
      }
    });
  }

  initialize().catch((e) => {
    console.error('Checkout initialization failed:', e);
    const summary = $('#summary');
    if (summary) summary.textContent =
      'Checkout load nahi hua. Page refresh karein.';
    const submit = $('#checkoutForm button[type="submit"]');
    if (submit) submit.disabled = true;
    message(e.message || 'Checkout load nahi hua.');
  });
})();
