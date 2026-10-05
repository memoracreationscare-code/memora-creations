(async function () {
  try {
    const dashboard = await window.requireAdmin();
    if (!dashboard) return;

    const stats = dashboard.stats || dashboard;
    const statsBox = document.querySelector('#stats');

    if (!statsBox) return;

    statsBox.innerHTML = `
      <div class="stat">
        <h3>Products</h3>
        <strong>${stats.products ?? stats.totalProducts ?? 0}</strong>
      </div>

      <div class="stat">
        <h3>Orders</h3>
        <strong>${stats.orders ?? stats.totalOrders ?? 0}</strong>
      </div>

      <div class="stat">
        <h3>Users</h3>
        <strong>${stats.users ?? stats.totalUsers ?? 0}</strong>
      </div>

      <div class="stat">
        <h3>Revenue</h3>
        <strong>${window.MC.money(stats.revenue ?? stats.totalRevenue ?? 0)}</strong>
      </div>
    `;
  } catch (e) {
    window.MC.toast(e.message, 'error');
  }
})();
