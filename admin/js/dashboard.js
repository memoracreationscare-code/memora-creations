
/*
=========================================
 MEMORA CREATIONS
 ADMIN DASHBOARD

 FEATURES:
 - Dashboard Statistics
 - Revenue Overview
 - Today's Orders
 - Pending Orders
 - Delivered Orders
 - COD Orders
 - Low Stock
 - Shiprocket Connection Test

 IMPORTANT:
 Order Notification Sound is handled
 by admin/js/order-notifications.js
=========================================
*/

(async function () {
  'use strict';

  /* =====================================
     CREATE STAT CARD
  ===================================== */

  function createStat(label, value) {
    const card = document.createElement('div');

    card.className = 'stat';

    const heading = document.createElement('h3');

    heading.textContent = label;

    const number = document.createElement('strong');

    number.textContent = String(
      value === undefined || value === null
        ? 0
        : value
    );

    card.append(heading, number);

    return card;
  }

  /* =====================================
     LOAD DASHBOARD STATISTICS
  ===================================== */

  async function loadDashboard() {
    try {
      const stats = await window.requireAdmin();

      if (!stats) return;

      const statsBox =
        document.getElementById('stats');

      if (!statsBox) return;

      const items = [
        [
          'Total Products',
          stats.totalProducts
        ],
        [
          'Total Orders',
          stats.totalOrders
        ],
        [
          'Total Customers',
          stats.totalCustomers
        ],
        [
          'Total Revenue',
          window.MC.money(stats.totalSales ?? 0)
        ],
        [
          'Today Orders',
          stats.todayOrders
        ],
        [
          'Pending Orders',
          stats.pendingOrders
        ],
        [
          'Delivered Orders',
          stats.deliveredOrders
        ],
        [
          'Cancelled Orders',
          stats.cancelledOrders
        ],
        [
          'Online Payments',
          stats.onlinePayments
        ],
        [
          'COD Orders',
          stats.codOrders
        ],
        [
          'Low Stock',
          stats.lowStockProducts
        ]
      ];

      statsBox.replaceChildren();

      items.forEach(([label, value]) => {
        statsBox.appendChild(
          createStat(label, value)
        );
      });

    } catch (error) {
      console.error(
        'Dashboard loading error:',
        error
      );

      if (
        window.MC &&
        typeof window.MC.toast === 'function'
      ) {
        window.MC.toast(
          error.message ||
          'Dashboard load failed.',
          'error'
        );
      }
    }
  }

  await loadDashboard();

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
        document.getElementById(
          'shiprocketResult'
        );

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
            (
              data.message ||
              'Shiprocket connected successfully.'
            );
        }

        window.MC.toast(
          'Shiprocket connected successfully.',
          'success'
        );

      } catch (error) {
        if (result) {
          result.textContent =
            '❌ ' +
            (
              error.message ||
              'Shiprocket connection failed.'
            );
        }

        window.MC.toast(
          error.message ||
          'Shiprocket connection failed.',
          'error'
        );
      }

    }
  );
