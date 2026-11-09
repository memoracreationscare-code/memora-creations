/*
  Cancellation requests page: shows orders that were cancelled
  automatically but where the refund or the Shiprocket cancel failed,
  so the owner can finish them by hand and press "Done".
*/
(() => {

  const { api, esc, money, toast } = window.MC;

  async function load() {
    let orders = [];

    try {
      orders = (await api('/admin/cancel-followups')).orders || [];
    } catch {
      return;
    }

    let panel = document.getElementById('cfPanel');

    if (!orders.length) { if (panel) panel.remove(); return; }

    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'cfPanel';
      panel.style.cssText =
        'margin:14px auto;max-width:1200px;padding:16px;border:2px solid #d62828;' +
        'border-radius:12px;background:#fff1f0;color:#4a1010';
      (document.querySelector('main') || document.body).prepend(panel);
    }

    panel.innerHTML = `
      <h2 style="margin:0 0 8px">Cancelled automatically - your check needed</h2>
      <p style="margin:0 0 10px">The order was cancelled and stock was returned, but one step
        did not finish. Do it by hand, then press <b>Done</b>.</p>
      ${orders.map(o => `
        <div style="background:#fff;border-radius:10px;padding:12px;margin-top:8px">
          <b>${esc(o.orderId)}</b> · ${esc(o.fullName)} ${esc(o.mobile)} · ${esc(money(o.amount))}<br>
          ${o.refundStatus === 'FAILED'
            ? `<span>Refund of ${esc(money(o.refundAmount))} did not go through. Open Cashfree →
               Payments → search <b>${esc(o.cashfreeOrderId)}</b> → refund.</span><br>` : ''}
          ${o.shiprocket === 'FAILED'
            ? '<span>Shiprocket order was not cancelled. Cancel it in your Shiprocket account.</span><br>' : ''}
          <small>${esc(o.error)}</small><br>
          <button class="btn secondary" type="button" data-cf-done="${esc(o.id)}">Done</button>
        </div>`).join('')}
    `;
  }

  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-cf-done]');

    if (!button) return;

    button.disabled = true;

    try {
      await api('/admin/cancel-followups/' + encodeURIComponent(button.dataset.cfDone) + '/done', { method: 'POST' });
      toast('Marked as done.', 'success');
      load();
    } catch (e) {
      button.disabled = false;
      toast(e.message || 'Could not update.', 'error');
    }
  });

  window.addEventListener('load', () => setTimeout(load, 800));
})();
