(async function () {

  try {

    const stats =
      await window.requireAdmin();

    if (!stats) return;


    const statsBox =
      document.querySelector('#stats');


    if (statsBox) {

      statsBox.innerHTML = `

        <div class="stat">
          <h3>Total Products</h3>
          <strong>
            ${stats.totalProducts ?? 0}
          </strong>
        </div>


        <div class="stat">
          <h3>Total Orders</h3>
          <strong>
            ${stats.totalOrders ?? 0}
          </strong>
        </div>


        <div class="stat">
          <h3>Total Customers</h3>
          <strong>
            ${stats.totalCustomers ?? 0}
          </strong>
        </div>


        <div class="stat">
          <h3>Total Revenue</h3>
          <strong>
            ${window.MC.money(
              stats.totalSales ?? 0
            )}
          </strong>
        </div>


        <div class="stat">
          <h3>Today Orders</h3>
          <strong>
            ${stats.todayOrders ?? 0}
          </strong>
        </div>


        <div class="stat">
          <h3>Pending Orders</h3>
          <strong>
            ${stats.pendingOrders ?? 0}
          </strong>
        </div>


        <div class="stat">
          <h3>Delivered Orders</h3>
          <strong>
            ${stats.deliveredOrders ?? 0}
          </strong>
        </div>


        <div class="stat">
          <h3>Cancelled Orders</h3>
          <strong>
            ${stats.cancelledOrders ?? 0}
          </strong>
        </div>


        <div class="stat">
          <h3>Online Payments</h3>
          <strong>
            ${stats.onlinePayments ?? 0}
          </strong>
        </div>


        <div class="stat">
          <h3>COD Orders</h3>
          <strong>
            ${stats.codOrders ?? 0}
          </strong>
        </div>


        <div class="stat">
          <h3>Low Stock</h3>
          <strong>
            ${stats.lowStockProducts ?? 0}
          </strong>
        </div>

      `;

    }


  } catch (error) {

    window.MC.toast(
      error.message ||
      'Dashboard load failed.',
      'error'
    );

  }

})();


/* =========================
   SHIPROCKET TEST
========================= */

document
  .querySelector('#testShiprocket')
  ?.addEventListener(
    'click',
    async () => {

      const result =
        document.querySelector(
          '#shiprocketResult'
        );


      if (result) {
        result.textContent =
          'Testing Shiprocket connection...';
      }


      try {

        const data =
          await window.MC.api(
            '/admin/shiprocket/test'
          );


        if (result) {

          result.innerHTML =
            '✅ ' +
            window.MC.esc(
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

          result.innerHTML =
            '❌ ' +
            window.MC.esc(
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
