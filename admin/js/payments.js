(() => {

  const { api, $, esc, money, toast } = window.MC;

  const list = $('#payList');
  const summary = $('#paySummary');
  let payments = [];
  const notes = {};

  function when(value) {
    const d = value ? new Date(value) : null;

    return d && !Number.isNaN(d.getTime())
      ? d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
      : '';
  }

  const line = (label, value) =>
    value ? `<div><b>${label}:</b> ${esc(value)}</div>` : '';

  function cardHtml(p) {
    const d = p.details || {};
    const card = d.cardLast4
      ? [d.cardNetwork, '•••• ' + d.cardLast4].filter(Boolean).join(' ')
      : '';

    const refundText = p.refund
      ? `<span class="rp-badge returned">${p.refund.status === 'REFUNDED' ? 'REFUNDED' : 'REFUND PROCESSING'} ${esc(money(p.refund.amount))}</span>`
      : '';

    const canRefund = !p.refund || p.refund.status !== 'REFUNDED' ||
      Number(p.refund.amount) < Number(p.amount) - 0.01;

    return `
      <article class="rp-card" data-id="${esc(p.id)}">
        <div>
          <span class="rp-badge undelivered">PAID ${esc(money(p.amount))}${p.isCodAdvance ? ' (COD advance)' : ''}</span>
          ${refundText}
          <div class="ac-name" style="margin-top:8px">${esc(p.fullName || 'Customer')}</div>
          <div class="ac-meta">
            ${esc(p.mobile)}<br>
            Order ${esc(p.orderId)} · ${esc(p.orderStatus)}<br>
            ${esc(when(d.paidAt || p.createdAt))}
          </div>
        </div>

        <div class="rp-lines">
          ${line('Method', d.method)}
          ${line('UPI ID (payer)', d.upiId)}
          ${line('UPI app', d.upiChannel)}
          ${line('UTR / bank reference', d.bankReference)}
          ${line('Bank', d.bankName)}
          ${line('Card', card)}
          ${line('Wallet / app', d.appProvider)}
          ${line('Cashfree payment ID', d.cfPaymentId || p.cashfreePaymentId)}
          ${line('Cashfree order ID', p.cashfreeOrderId)}
          ${d.method || d.upiId || d.bankReference ? '' : '<div class="rp-muted">Details not saved yet. Press Verify to fetch them from Cashfree.</div>'}
          <div class="rp-muted" data-result style="color:${notes[p.id]?.ok ? '#1b6e2d' : '#b42318'}">${esc(notes[p.id]?.text || '')}</div>
        </div>

        <div class="ac-actions">
          <button class="ac-mark" data-act="verify" type="button">Verify</button>
          ${canRefund ? '<button class="ac-mark" data-act="refund" type="button">Refund</button>' : ''}
        </div>
      </article>`;
  }

  function render() {
    list.innerHTML = payments.length
      ? payments.map(cardHtml).join('')
      : '<div class="ac-state">No online payments yet.</div>';
  }

  let busy = false;

  async function load(quiet) {
    if (busy) return;

    const q = $('#payQ').value.trim();

    if (!quiet) list.innerHTML = '<div class="ac-state">Loading...</div>';

    try {
      const data = await api('/admin/payments' + (q ? '?q=' + encodeURIComponent(q) : ''));

      payments = data.payments || [];

      const t = data.totals || {};

      summary.textContent =
        `${t.count || 0} payments · received ${money(t.amount || 0)} · refunded ${money(t.refunded || 0)}`;

      render();

    } catch (e) {
      if (!quiet) {
        list.innerHTML =
          '<div class="ac-state">Could not load payments. If the server was asleep, wait a minute and press Refresh.</div>';
      }
    }
  }

  list.addEventListener('click', async event => {
    const button = event.target.closest('[data-act]');

    if (!button) return;

    const card = button.closest('[data-id]');
    const p = payments.find(x => x.id === card.dataset.id);
    const result = card.querySelector('[data-result]');

    if (!p) return;

    busy = true;
    button.disabled = true;

    try {
      if (button.dataset.act === 'verify') {
        const r = await api('/admin/payments/' + encodeURIComponent(p.id) + '/verify', { method: 'POST' });

        notes[p.id] = { ok: r.verified, text: (r.verified ? '✔ ' : '✖ ') + r.message };
        result.textContent = notes[p.id].text;
        toast(r.verified ? 'Payment verified.' : 'Payment NOT verified.', r.verified ? 'success' : 'error');

        busy = false;
        await load(true);
        return;
      }

      const left = Number(p.amount) - Number(p.refund?.amount || 0);
      const input = await window.mcPrompt(
        `Refund amount for ${p.orderId} (paid ${money(p.amount)}).\n` +
        `Leave as it is for a FULL refund of ${left.toFixed(2)}, or type a smaller amount:`,
        { title: 'Refund amount', defaultValue: left.toFixed(2), okText: 'Aage badho' }
      );

      if (input === null) { button.disabled = false; busy = false; return; }

      const amount = Number(input);

      if (!Number.isFinite(amount) || amount <= 0) {
        toast('Enter a valid amount.', 'error');
        button.disabled = false;
        busy = false;
        return;
      }

      if (!(await window.mcConfirm(
        `Send a refund of ${money(amount)} to ${p.fullName || 'the customer'} for order ${p.orderId}?\n\n` +
        'This sends real money back through Cashfree and cannot be undone.',
        { title: 'Refund bhejna hai?', okText: 'Haan, refund bhejo', danger: true }
      ))) {
        button.disabled = false;
        busy = false;
        return;
      }

      const r = await api('/admin/payments/' + encodeURIComponent(p.id) + '/refund', {
        method: 'POST',
        body: JSON.stringify({ amount, confirmed: true, note: 'Refund for order ' + p.orderId })
      });

      toast(r.message, 'success');
      busy = false;
      await load(true);

    } catch (e) {
      toast(e.message || 'Action failed.', 'error');
      result.style.color = '#b42318';
      result.textContent = '✖ ' + (e.message || 'Action failed.');
      button.disabled = false;
    } finally {
      busy = false;
    }
  });

  $('#payRefresh').addEventListener('click', () => load(false));

  $('#payQ').addEventListener('keydown', e => {
    if (e.key === 'Enter') load(false);
  });

  (async () => {
    if (await window.requireAdmin()) {
      load(false);
      setInterval(() => { if (!document.hidden) load(true); }, 30000);
    }
  })();

})();
