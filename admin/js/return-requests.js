(() => {

  const { api, $, esc, money, toast } = window.MC;

  const LABEL = {
    REQUESTED: 'New',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    COMPLETED: 'Completed'
  };

  const list = $('#rqList');
  const summary = $('#rqSummary');

  let requests = [];
  let filter = 'REQUESTED';

  function when(value) {
    const d = value ? new Date(value) : null;

    return d && !Number.isNaN(d.getTime())
      ? d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
      : '';
  }

  function whatsappUrl(r) {
    const mobile = String(r.mobile || '').replace(/\D/g, '').slice(-10);
    const name = String(r.fullName || '').trim().split(/\s+/)[0] || 'Customer';
    const text =
      `Namaste ${name} ji 🙏\n` +
      `Memora Creations me aapke order ${r.orderId} ki ` +
      `${r.type === 'RETURN' ? 'return' : 'replacement'} request mili hai. ` +
      'Kripya product aur parcel ki clear photos bhej dijiye, hum jaldi dekhte hain.';

    return `https://wa.me/91${mobile}?text=${encodeURIComponent(text)}`;
  }

  function cardHtml(r) {
    const items = r.items
      .map(i => `${esc(i.name)} × ${esc(i.quantity)}`)
      .join(', ');

    const actions = r.status === 'REQUESTED'
      ? `<button class="ac-mark" data-act="APPROVED" data-id="${esc(r.id)}" type="button">Approve</button>
         <button class="ac-mark" data-act="REJECTED" data-id="${esc(r.id)}" type="button">Reject</button>`
      : r.status === 'APPROVED'
        ? `<button class="ac-mark" data-act="COMPLETED" data-id="${esc(r.id)}" type="button">Mark completed</button>`
        : '';

    return `
      <article class="rp-card">
        <div>
          <span class="rp-badge ${r.status === 'REQUESTED' ? 'undelivered' : 'returned'}">
            ${esc(r.type)} · ${esc(LABEL[r.status] || r.status)}
          </span>
          <div class="ac-name" style="margin-top:8px">${esc(r.fullName || 'Customer')}</div>
          <div class="ac-meta">
            ${esc(r.mobile)}<br>
            Order ${esc(r.orderId)} · ${esc(money(r.amount))}
            ${r.paymentMethod === 'COD' ? '<span class="rp-cod">COD</span>' : ''}
          </div>
        </div>

        <div class="rp-lines">
          <div><b>Reason:</b> ${esc(r.reason)}</div>
          <div>${esc(r.details)}</div>
          <div class="rp-muted">${items}</div>
          <div class="rp-muted">Requested: ${esc(when(r.requestedAt))}</div>
          ${r.adminNote ? `<div class="rp-muted"><b>Your note:</b> ${esc(r.adminNote)}</div>` : ''}
        </div>

        <div class="ac-actions">
          <a class="ac-wa" target="_blank" rel="noopener noreferrer"
             href="${esc(whatsappUrl(r))}">Contact customer</a>
          ${actions}
        </div>
      </article>`;
  }

  function render() {
    const shown = requests.filter(r => filter === 'all' || r.status === filter);

    summary.textContent = shown.length
      ? `${shown.length} request${shown.length === 1 ? '' : 's'}`
      : '';

    list.innerHTML = shown.length
      ? shown.map(cardHtml).join('')
      : '<div class="ac-state">No requests here.</div>';
  }

  async function load() {
    list.innerHTML = '<div class="ac-state">Loading...</div>';

    try {
      const data = await api('/admin/return-requests');

      requests = data.requests || [];
      render();

    } catch (e) {
      list.innerHTML =
        '<div class="ac-state">Could not load requests. If the server was asleep, wait a minute and press Refresh.</div>';
      toast(e.message || 'Could not load return requests.', 'error');
    }
  }

  list.addEventListener('click', async event => {
    const button = event.target.closest('[data-act]');

    if (!button) return;

    const status = button.dataset.act;
    let note = '';

    if (status !== 'COMPLETED') {
      note = window.prompt(
        status === 'REJECTED'
          ? 'Reason to show the customer (optional):'
          : 'Message for the customer (optional):',
        ''
      );

      if (note === null) return;
    }

    button.disabled = true;

    try {
      await api('/admin/return-requests/' + encodeURIComponent(button.dataset.id), {
        method: 'PATCH',
        body: JSON.stringify({ status, adminNote: note })
      });

      toast('Updated.', 'success');
      await load();

    } catch (e) {
      button.disabled = false;
      toast(e.message || 'Could not update.', 'error');
    }
  });

  $('#rqTabs').addEventListener('click', event => {
    const tab = event.target.closest('[data-s]');

    if (!tab) return;

    filter = tab.dataset.s;

    document.querySelectorAll('#rqTabs .rp-tab').forEach(el =>
      el.classList.toggle('active', el === tab)
    );

    render();
  });

  $('#rqRefresh').addEventListener('click', load);

  (async () => {
    if (await window.requireAdmin()) load();
  })();

})();
