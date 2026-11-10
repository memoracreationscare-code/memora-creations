(() => {

  const { api, $, toast } = window.MC;

  const TEXT = [
    'storeClosedMessage', 'whatsapp', 'phone', 'email', 'address', 'instagram',
    'facebook', 'youtube', 'heroKicker', 'heroLine1', 'heroHighlight',
    'heroDescription', 'heroButtonText'
  ];

  const NUMBER = [
    'deliveryCharge', 'freeDeliveryAbove', 'codAdvancePercent',
    'returnWindowDays', 'codAutoReceiveDays', 'abandonedReminderHours'
  ];

  const BOOL = [
    'storeOpen', 'freeDeliveryBar', 'codEnabled', 'codAdvanceEnabled',
    'returnsEnabled', 'autoRefundEnabled', 'emailNotificationsEnabled',
    'abandonedReminderEnabled'
  ];

  function showMail(configured) {
    const box = $('#mailState');

    if (!box || configured === undefined) return;

    box.style.color = configured ? '#1b6e2d' : '#b42318';
    box.textContent = configured
      ? '✔ Email service is connected.'
      : '✖ Email service is not connected yet, so nothing can be sent. Add BREVO_API_KEY and MAIL_FROM_EMAIL in Render (steps are in the README).';
  }

  function fill(s) {
    TEXT.forEach(k => { $('#' + k).value = s[k] || ''; });
    NUMBER.forEach(k => { $('#' + k).value = s[k] ?? ''; });
    BOOL.forEach(k => { $('#' + k).checked = s[k] === true; });
  }

  function message(text, ok) {
    const box = $('#stMsg');

    box.textContent = text;
    box.style.color = ok ? '#1b6e2d' : '#b42318';
  }

  async function load() {
    try {
      const data = await api('/admin/settings');

      fill(data.settings || {});
      showMail(data.mailConfigured);

    } catch (e) {
      message('Could not load settings. If the server was asleep, wait a minute and reload.', false);
    }
  }

  $('#stForm').addEventListener('submit', async event => {
    event.preventDefault();

    const body = {};

    TEXT.forEach(k => { body[k] = $('#' + k).value; });
    NUMBER.forEach(k => { body[k] = $('#' + k).value; });
    BOOL.forEach(k => { body[k] = $('#' + k).checked; });

    if (!body.storeOpen && !window.confirm('The store will be CLOSED: customers cannot place orders. Continue?')) {
      return;
    }

    const button = $('#stSave');

    button.disabled = true;

    try {
      const data = await api('/admin/settings', { method: 'PUT', body: JSON.stringify(body) });

      fill(data.settings || {});
      showMail(data.mailConfigured);
      message('✔ ' + (data.message || 'Saved.'), true);
      toast('Settings saved.', 'success');

    } catch (e) {
      message('✖ ' + (e.message || 'Could not save.'), false);
      toast(e.message || 'Could not save.', 'error');
    } finally {
      button.disabled = false;
    }
  });

  (async () => {
    if (await window.requireAdmin()) load();
  })();

})();
