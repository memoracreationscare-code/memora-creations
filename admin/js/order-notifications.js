
/*
=========================================
 MEMORA CREATIONS
 ADMIN ORDER NOTIFICATIONS

 Reusable across Admin pages.

 - Today's orders
 - Unseen order badge
 - Auto refresh every 30 seconds
 - Mark as Seen
 - View Orders
 - Admin authentication required
=========================================
*/

(function () {
  'use strict';

  const ORDERS_URL =
    '/memora-creations/admin/orders.html';

  const STORAGE_KEY =
    'mc_admin_orders_seen_v1';

  const POLL_INTERVAL = 30000;

  let orders = [];
  let previousIds = null;
  let loading = false;

  function make(tag, value) {
    const element = document.createElement(tag);

    if (value !== undefined) {
      element.textContent = String(value);
    }

    return element;
  }

  function indianDate(value) {
    const date = new Date(value);

    if (!Number.isFinite(date.getTime())) {
      return '';
    }

    const parts = new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }
    ).formatToParts(date);

    const get = type =>
      parts.find(p => p.type === type)?.value || '';

    return (
      get('year') + '-' +
      get('month') + '-' +
      get('day')
    );
  }

  function readSeen() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || '{}'
      );

      return new Set(
        Array.isArray(saved.ids)
          ? saved.ids.map(String)
          : []
      );

    } catch (_) {
      return new Set();
    }
  }

  function markSeen() {
    try {
      /*
        Preserve IDs previously seen,
        including older orders outside
        the most recent 200 results.
      */

      const seen = readSeen();

      orders.forEach(order => {
        if (order._id) {
          seen.add(String(order._id));
        }
      });

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ids: [...seen].slice(-1000),
          updatedAt: new Date().toISOString()
        })
      );

      render();

    } catch (_) {
      showStatus(
        'Browser storage unavailable.'
      );
    }
  }

  function showStatus(message) {
    const status = document.getElementById(
      'mcAdminNotificationStatus'
    );

    if (status) {
      status.textContent = message;
    }
  }

  function render() {
    const badge = document.getElementById(
      'mcAdminNotificationBadge'
    );

    if (!badge) return;

    const seen = readSeen();

    const unseen = orders.filter(
      order =>
        order._id &&
        !seen.has(String(order._id))
    );

    const today = indianDate(new Date());

    const todayOrders = orders.filter(
      order => indianDate(order.createdAt) === today
    );

    badge.textContent =
      unseen.length + ' New';

    badge.style.background =
      unseen.length > 0
        ? '#b45309'
        : '#777';

    const latest = todayOrders
      .slice()
      .sort(
        (a, b) =>
          new Date(b.createdAt) -
          new Date(a.createdAt)
      )[0];

    const latestText = latest
      ? ' Latest: ' +
        String(latest.orderId || 'New Order')
      : '';

    showStatus(
      'Aaj ' +
      todayOrders.length +
      ' order(s) aaye hain. ' +
      'Unseen: ' +
      unseen.length +
      '.' +
      latestText
    );
  }

  function buildBar() {
    if (
      document.getElementById(
        'mcAdminNotifications'
      )
    ) {
      return;
    }

    const bar = make('section');
    bar.id = 'mcAdminNotifications';

    bar.setAttribute(
      'aria-label',
      'Admin order notifications'
    );

    bar.style.cssText = [
      'max-width:1200px',
      'margin:18px auto',
      'padding:15px 18px',
      'background:#fff8ee',
      'border:1px solid #e8ceb2',
      'border-radius:14px',
      'display:flex',
      'align-items:center',
      'justify-content:space-between',
      'gap:14px',
      'flex-wrap:wrap',
      'box-shadow:0 5px 20px #3021170a'
    ].join(';');

    const info = make('div');

    const heading = make(
      'strong',
      '🔔 Order Notifications'
    );

    heading.style.cssText =
      'display:block;color:#302117;font-size:16px';

    const status = make(
      'p',
      'Checking new orders...'
    );

    status.id =
      'mcAdminNotificationStatus';

    status.setAttribute(
      'aria-live',
      'polite'
    );

    status.style.cssText =
      'margin:7px 0 0;color:#805e43;font-size:13px';

    info.append(heading, status);

    const controls = make('div');

    controls.style.cssText = [
      'display:flex',
      'align-items:center',
      'gap:10px',
      'flex-wrap:wrap'
    ].join(';');

    const badge = make('span', '0 New');

    badge.id =
      'mcAdminNotificationBadge';

    badge.style.cssText = [
      'background:#777',
      'color:white',
      'padding:8px 12px',
      'border-radius:30px',
      'font-weight:800',
      'font-size:12px'
    ].join(';');

    const markButton = make(
      'button',
      'Mark as Seen'
    );

    markButton.type = 'button';

    markButton.style.cssText = [
      'border:1px solid #ddc2a8',
      'background:#f3e5d8',
      'color:#543521',
      'border-radius:10px',
      'padding:10px 12px',
      'font-weight:700',
      'font-size:12px',
      'cursor:pointer'
    ].join(';');

    markButton.addEventListener(
      'click',
      markSeen
    );

    const link = make(
      'a',
      'View Orders →'
    );

    link.href = ORDERS_URL;

    link.style.cssText = [
      'background:#302117',
      'color:white',
      'padding:11px 15px',
      'border-radius:10px',
      'font-weight:700',
      'font-size:12px',
      'text-decoration:none'
    ].join(';');

    controls.append(
      badge,
      markButton,
      link
    );

    bar.append(info, controls);

    /*
      Insert below the standard
      Admin navigation bar.
    */

    const nav =
      document.querySelector('.adminnav');

    if (nav) {
      nav.insertAdjacentElement(
        'afterend',
        bar
      );

    } else {
      document.body.prepend(bar);
    }
  }

  async function checkOrders() {
    if (
      loading ||
      document.hidden
    ) {
      return;
    }

    loading = true;

    try {
      const result = await window.MC.api(
        '/admin/orders'
      );

      if (!Array.isArray(result.orders)) {
        throw new Error(
          'Invalid orders response.'
        );
      }

      orders = result.orders;

      const ids = new Set(
        orders.map(order => String(order._id))
      );

      /*
        Alert only when an order was
        added after a previous check.
      */

      if (previousIds) {
        const fresh = orders.filter(
          order =>
            order._id &&
            !previousIds.has(String(order._id))
        );

        if (fresh.length > 0) {
          window.MC.toast(
            '🔔 ' +
            fresh.length +
            ' new customer order(s)!',
            'success'
          );
        }
      }

      previousIds = ids;

      render();

    } catch (err) {
      showStatus(
        'Orders notification check failed. ' +
        'Refresh or login again.'
      );

      console.error(
        'Admin notifications error:',
        err
      );

    } finally {
      loading = false;
    }
  }

  async function start() {
    /*
      Never fetch admin orders
      without checking login.
    */

    if (
      !window.MC ||
      typeof window.MC.api !== 'function' ||
      typeof window.requireAdmin !== 'function'
    ) {
      return;
    }

    const admin =
      await window.requireAdmin();

    if (!admin) return;

    buildBar();

    await checkOrders();

    window.setInterval(
      checkOrders,
      POLL_INTERVAL
    );

    document.addEventListener(
      'visibilitychange',
      () => {
        if (!document.hidden) {
          checkOrders();
        }
      }
    );
  }

  start().catch(err => {
    console.error(
      'Notification startup error:',
      err
    );
  });

})();
