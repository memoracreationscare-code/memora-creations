
/*
=========================================
 MEMORA CREATIONS
 ADMIN DASHBOARD

 EXISTING FEATURES:
 - Dashboard statistics
 - Shiprocket connection test

 NEW FEATURE:
 - Order notification bar
 - Today's orders
 - New order badge
 - Auto refresh every 30 seconds
 - View orders shortcut
 - Mark notifications as seen
=========================================
*/

(async function () {
  'use strict';

  const BASE = '/memora-creations';
  const ORDERS_URL = BASE + '/admin/orders.html';

  const POLL_MS = 30000;
  const SEEN_KEY = 'mc_admin_orders_seen_v1';

  let checkingOrders = false;
  let latestOrders = [];
  let lastOrderIds = new Set();
  let initialized = false;

  function orderTime(order) {
    return new Date(order.createdAt || 0).getTime();
  }

  function dateKey(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
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

  function todayOrders(orders) {
    const today = dateKey(new Date());

    return orders.filter(order =>
      dateKey(order.createdAt) === today
    );
  }

  function readSeen() {
    try {
      const value = JSON.parse(
        localStorage.getItem(SEEN_KEY) || '{}'
      );

      return Array.isArray(value.ids)
        ? new Set(value.ids.map(String))
        : new Set();

    } catch (_) {
      return new Set();
    }
  }

  function saveSeen(orders) {
    try {
      localStorage.setItem(
        SEEN_KEY,
        JSON.stringify({
          ids: orders.map(order => String(order._id)),
          updatedAt: new Date().toISOString()
        })
      );
    } catch (_) {
      // Browser storage unavailable.
    }
  }

  function element(tag, text) {
    const el = document.createElement(tag);

    if (text !== undefined) {
      el.textContent = String(text);
    }

    return el;
  }

  function addNotificationBar() {
    const page = document.querySelector('.mc-page');
    const heading = page?.querySelector('.mc-heading');

    if (!page || !heading) {
      return null;
    }

    const bar = element('section');
    bar.id = 'mcOrderNotificationBar';

    bar.setAttribute('aria-label', 'Order notifications');

    bar.style.cssText = [
      'background:#fff8ef',
      'border:1px solid #e3c8a7',
      'border-radius:15px',
      'padding:17px 20px',
      'margin:0 0 25px',
      'display:flex',
      'align-items:center',
      'justify-content:space-between',
      'gap:16px',
      'flex-wrap:wrap',
      'box-shadow:0 5px 20px rgba(48,33,23,.05)'
    ].join(';');

    const info = element('div');

    const title = element(
      'strong',
      '🔔 Order Notifications'
    );

    title.style.cssText =
      'display:block;font-size:17px;color:#302117';

    const description = element(
      'p',
      'Checking new orders...'
    );

    description.id = 'mcOrderNotificationText';
    description.setAttribute('aria-live', 'polite');

    description.style.cssText =
      'margin:7px 0 0;font-size:13px;color:#755a42';

    info.append(title, description);

    const controls = element('div');

    controls.style.cssText =
      'display:flex;gap:10px;align-items:center;flex-wrap:wrap';

    const badge = element('span', '0 New');
    badge.id = 'mcNewOrdersBadge';

    badge.style.cssText = [
      'background:#8c4e2b',
      'color:white',
      'border-radius:30px',
      'padding:8px 12px',
      'font-weight:800',
      'font-size:12px'
    ].join(';');

    const seenButton = element(
      'button',
      'Mark as Seen'
    );

    seenButton.type = 'button';
    seenButton.id = 'mcMarkOrdersSeen';

    seenButton.style.cssText = [
      'background:#f1e4d7',
      'border:1px solid #dcc1a7',
      'border-radius:9px',
      'padding:10px 12px',
      'font-size:12px',
      'font-weight:700',
      'cursor:pointer',
      'color:#543521'
    ].join(';');

    const viewLink = element(
      'a',
      'View Orders →'
    );

    viewLink.href = ORDERS_URL;

    viewLink.style.cssText = [
      'background:#302117',
      'color:#fff',
      'padding:11px 15px',
      'border-radius:10px',
      'text-decoration:none',
      'font-weight:700',
      'font-size:12px'
    ].join(';');

    controls.append(
      badge,
      seenButton,
      viewLink
    );

    bar.append(info, controls);

    heading.insertAdjacentElement(
      'afterend',
      bar
    );

    seenButton.addEventListener(
      'click',
      () => {
        saveSeen(latestOrders);
        renderNotifications(latestOrders);
      }
    );

    return bar;
  }

  function renderNotifications(orders) {
    const description = document.getElementById(
      'mcOrderNotificationText'
    );

    const badge = document.getElementById(
      'mcNewOrdersBadge'
    );

    if (!description || !badge) {
      return;
    }

    const today = todayOrders(orders);
    const seen = readSeen();

    const unread = orders.filter(order =>
      order._id &&
      !seen.has(String(order._id))
    );

    badge.textContent =
      unread.length + ' New';

    badge.style.background =
      unread.length > 0 ? '#b45309' : '#777';

    if (today.length === 0) {
      description.textContent =
        'Aaj abhi koi naya order nahi aaya. ' +
        'Total unseen orders: ' + unread.length + '.';

      return;
    }

    const latest = today
      .slice()
      .sort((a, b) =>
        orderTime(b) - orderTime(a)
      )[0];

    description.textContent =
      'Aaj ' + today.length +
      ' order(s) aaye hain. ' +
      'Unseen: ' + unread.length +
      '. Latest: ' +
      String(latest.orderId || 'New Order') +
      ' — ' +
      window.MC.money(latest.grandTotal || 0);
  }

  async function refreshOrders() {
    if (checkingOrders) return;

    if (document.hidden) return;

    checkingOrders = true;

    try {
      const response = await window.MC.api(
        '/admin/orders'
      );

      const orders = Array.isArray(response.orders)
        ? response.orders
        : [];

      latestOrders = orders;

      const currentIds = new Set(
        orders.map(order => String(order._id))
      );

      /*
        When dashboard is already open,
        newly detected orders receive a
        visible notification.
      */

      if (initialized) {
        const newOrders = orders.filter(order =>
          !lastOrderIds.has(String(order._id))
        );

        if (newOrders.length > 0) {
          window.MC.toast(
            '🔔 ' + newOrders.length +
            ' new order(s) received!',
            'success'
          );
        }
      }

      lastOrderIds = currentIds;
      initialized = true;

      renderNotifications(orders);

    } catch (err) {
      const description = document.getElementById(
        'mcOrderNotificationText'
      );

      if (description) {
        description.textContent =
          'Orders check nahi ho pa rahe. ' +
          'Internet ya Admin Login check karein.';
      }

      console.error(
        'Order notification check failed:',
        err
      );

    } finally {
      checkingOrders = false;
    }
  }

  try {
    const stats = await window.requireAdmin();

    if (!stats) return;

    /*
      Existing dashboard statistics.
    */

    const statsBox =
      document.querySelector('#stats');

    if (statsBox) {
      const values = [
        ['Total Products', stats.totalProducts],
        ['Total Orders', stats.totalOrders],
        ['Total Customers', stats.totalCustomers],
        ['Total Revenue', window.MC.money(stats.totalSales)],
        ['Today Orders', stats.todayOrders],
        ['Pending Orders', stats.pendingOrders],
        ['Delivered Orders', stats.deliveredOrders],
        ['Cancelled Orders', stats.cancelledOrders],
        ['Online Payments', stats.onlinePayments],
        ['COD Orders', stats.codOrders],
        ['Low Stock', stats.lowStockProducts]
      ];

      statsBox.replaceChildren();

      for (const [label, value] of values) {
        const card = element('div');
        card.className = 'stat';

        card.append(
          element('h3', label),
          element('strong', value ?? 0)
        );

        statsBox.appendChild(card);
      }
    }

    /*
      New notification bar.
    */

    const notificationBar =
      addNotificationBar();

    if (notificationBar) {
      await refreshOrders();

      window.setInterval(
        refreshOrders,
        POLL_MS
      );

      document.addEventListener(
        'visibilitychange',
        () => {
          if (!document.hidden) {
            refreshOrders();
          }
        }
      );
    }

  } catch (error) {
    window.MC.toast(
      error.message || 'Dashboard load failed.',
      'error'
    );
  }

})();


/* =====================================
   SHIPROCKET CONNECTION TEST

   EXISTING FEATURE PRESERVED
===================================== */

document
  .querySelector('#testShiprocket')
  ?.addEventListener(
    'click',
    async () => {
      const result =
        document.querySelector('#shiprocketResult');

      if (result) {
        result.textContent =
          'Testing Shiprocket connection...';
      }

      try {
        const data = await window.MC.api(
          '/admin/shiprocket/test'
        );

        if (result) {
          result.textContent =
            '✅ ' +
            (data.message ||
              'Shiprocket connected successfully.');
        }

        window.MC.toast(
          'Shiprocket connected successfully.',
          'success'
        );

      } catch (error) {
        if (result) {
          result.textContent =
            '❌ ' +
            (error.message ||
              'Shiprocket connection failed.');
        }

        window.MC.toast(
          error.message ||
          'Shiprocket connection failed.',
          'error'
        );
      }
    }
  );
