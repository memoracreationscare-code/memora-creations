(() => {

  const { api, $, esc, money, toast } = window.MC;

  const STAGES = {
    atCourier: 'With courier',
    awaiting: 'Money awaited',
    received: 'Received',
    notCollected: 'Not collected',
    notShipped: 'Not shipped'
  };

  const list = $('#crList');
  const cards = $('#crCards');
  const summary = $('#crSummary');

  let rows = [];
  let filter = 'all';

  const plural = n => `${n} order${Number(n) === 1 ? '' : 's'}`;

  const day = value => {
    if (!value) return '';
    const d = new Date(value);

    return Number.isNaN(d.getTime())
      ? ''
      : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  function renderCards(data) {
    const t = data.totals || {};
    const c = data.counts || {};
    const wallet = data.wallet || {};

    const walletText = !wallet.connected
      ? 'Not connected'
      : wallet.balance === null
        ? 'Connected'
        : money(wallet.balance);

    cards.innerHTML = `
      <div class="cr-card"><small>With courier</small><strong>${esc(money(t.atCourier))}</strong><span>${esc(plural(c.atCourier || 0))} on the way</span></div>
      <div class="cr-card warn"><small>Money awaited</small><strong>${esc(money(t.awaiting))}</strong><span>${esc(plural(c.awaiting || 0))} delivered, not yet received</span></div>
      <div class="cr-card good"><small>Received</small><strong>${esc(money(t.received))}</strong><span>${esc(plural(c.received || 0))} marked received</span></div>
      <div class="cr-card"><small>Not collected</small><strong>${esc(money(t.notCollected))}</strong><span>${esc(plural(c.notCollected || 0))} returned / undelivered</span></div>
      <div class="cr-card"><small>Shiprocket wallet</small><strong>${esc(walletText)}</strong><span>live from Shiprocket</span></div>`;
  }

  function timing(row) {
    if (row.stage === 'awaiting') {
      const range = row.expectedFrom
        ? `Expected ${day(row.expectedFrom)} – ${day(row.expectedTo)}`
        : '';

      return `Delivered ${esc(day(row.deliveredAt))}` +
        (row.daysSinceDelivery !== null ? ` · ${esc(row.daysSinceDelivery)} days ago` : '') +
        (range ? `<br><span class="rp-muted">${esc(range)}</span>` : '');
    }

    if (row.stage === 'received') return row.deliveredAt ? `Delivered ${esc(day(row.deliveredAt))}` : '';
    if (row.stage === 'atCourier') return esc(row.courierStatus || row.orderStatus);
    if (row.stage === 'notCollected') return esc(row.courierStatus || '');

    return esc(row.orderStatus);
  }

  function render() {
    const shown = rows.filter(r => filter === 'all' || r.stage === filter);

    if (!shown.length) {
      summary.textContent = '';
      list.innerHTML = '<div class="ac-state">No orders in this list.</div>';
      return;
    }

    const total = shown.reduce((sum, r) => sum + Number(r.amount || 0), 0);

    summary.textContent = `${shown.length} order${shown.length === 1 ? '' : 's'} · ${money(total)}`;

    list.innerHTML = `
      <table class="cr-table">
        <thead><tr>
          <th>Order</th><th>Customer</th><th>Courier</th><th>Status</th><th>Details</th><th class="num">Amount</th><th></th>
        </tr></thead>
        <tbody>
          ${shown.map(r => `
            <tr>
              <td><b>${esc(r.orderId)}</b><br><span class="rp-muted">${esc(day(r.createdAt))}</span></td>
              <td>${esc(r.customer)}<br><span class="rp-muted">${esc(r.mobile)}</span></td>
              <td>${esc(r.courierName || '-')}<br><span class="rp-muted">${esc(r.awbCode)}</span></td>
              <td><span class="cr-stage ${esc(r.stage)}">${esc(STAGES[r.stage])}</span></td>
              <td>${timing(r)}</td>
              <td class="num">${esc(money(r.amount))}${r.advancePaid ? `<br><span class="rp-muted" style="font-weight:400">after ₹${esc(r.advancePaid)} advance</span>` : ''}</td>
              <td>${r.stage === 'awaiting'
                ? `<button class="cr-btn" type="button" data-paid="${esc(r.orderMongoId)}">Mark as received</button>`
                : ''}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }

  async function load() {
    list.innerHTML = '<div class="ac-state">Loading...</div>';

    try {
      const data = await api('/admin/cod-remittance');

      rows = data.rows || [];
      renderCards(data);
      render();

    } catch (e) {
      rows = [];
      list.innerHTML = '<div class="ac-state">Could not load. If the server was asleep, wait a minute and press Refresh.</div>';
      toast(e.message || 'Could not load COD details.', 'error');
    }
  }

  list.addEventListener('click', async event => {
    const button = event.target.closest('[data-paid]');

    if (!button) return;

    if (!confirm('Has this COD money reached your bank? This only updates your record.')) return;

    button.disabled = true;

    try {
      await api('/admin/orders/' + encodeURIComponent(button.dataset.paid) + '/cod/paid', {
        method: 'PATCH',
        body: JSON.stringify({ confirmed: true })
      });

      toast('Marked as received.', 'success');
      await load();

    } catch (e) {
      toast(e.message || 'Could not update.', 'error');
      button.disabled = false;
    }
  });

  $('#crTabs').addEventListener('click', event => {
    const tab = event.target.closest('[data-stage]');

    if (!tab) return;

    filter = tab.dataset.stage;
    document.querySelectorAll('#crTabs .rp-tab').forEach(el => el.classList.toggle('active', el === tab));
    render();
  });

  $('#crRefresh').addEventListener('click', load);

  (async () => {
    if (await window.requireAdmin()) load();
  })();

})();
