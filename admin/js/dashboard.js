const { api, $, money, esc, toast } = window.MC;

async function loadDashboard() {
  try {
    const dashboard = await requireAdmin();
    if (!dashboard) return;

    const stats = dashboard.stats || dashboard;

    $('#stats').innerHTML = `
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
        <strong>${money(stats.revenue ?? stats.totalRevenue ?? 0)}</strong>
      </div>
    `;
  } catch (e) {
    toast(e.message, 'error');
  }
}

loadDashboard();
