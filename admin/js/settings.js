(() => {

  const { api, $, toast } = window.MC;

  const TEXT = [
    'storeClosedMessage', 'whatsapp', 'phone', 'email', 'address', 'instagram',
    'facebook', 'youtube', 'heroKicker', 'heroLine1', 'heroHighlight',
    'heroDescription', 'heroButtonText',
    'gstLegalName', 'gstin', 'gstState', 'chatFaq'
  ];

  const NUMBER = [
    'deliveryCharge', 'freeDeliveryAbove', 'codAdvancePercent',
    'returnWindowDays', 'codAutoReceiveDays', 'abandonedReminderHours',
    'welcomePercent', 'welcomeMaxDiscount', 'welcomeMinOrder',
    'referralFriendAmount', 'referralRewardAmount', 'referralMinOrder',
    'giftWrapStandardFee', 'giftWrapPremiumFee', 'gstRate'
  ];

  const BOOL = [
    'storeOpen', 'freeDeliveryBar', 'codEnabled', 'codAdvanceEnabled',
    'returnsEnabled', 'autoRefundEnabled', 'emailNotificationsEnabled',
    'abandonedReminderEnabled', 'lowStockEmailEnabled', 'welcomeEnabled', 'referralEnabled', 'giftWrapEnabled', 'chatEnabled', 'gstEnabled', 'backupEmailEnabled'
  ];

  function showChat(configured) {
    const box = $('#chatKeyState');

    if (!box || configured === undefined) return;

    box.style.color = configured ? '#1b6e2d' : '#b42318';
    box.textContent = configured
      ? '✔ AI key Render me laga hai.'
      : '✖ AI key abhi nahi laga. Free ke liye Render → Environment me GEMINI_API_KEY daalein (ya paid Claude ke liye ANTHROPIC_API_KEY), tab chat chalega.';
  }

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

  $('#chatTest')?.addEventListener('click', async () => {
    const btn = $('#chatTest');
    const out = $('#chatTestMsg');

    btn.disabled = true;
    out.style.color = '#7a6a58';
    out.textContent = 'Test ho raha hai… (10 second tak lag sakte hain)';

    try {
      const data = await api('/admin/chat-test', { method: 'POST', body: '{}' });

      out.style.color = data.ok ? '#1b6e2d' : '#b42318';
      out.textContent = (data.ok ? '' : '✖ ') + data.message;
    } catch (err) {
      out.style.color = '#b42318';
      out.textContent = '✖ ' + (err.message || 'Test nahi ho paya.');
    } finally {
      btn.disabled = false;
    }
  });

  $('#backupNow')?.addEventListener('click', async () => {
    const btn = $('#backupNow');

    btn.disabled = true;
    btn.textContent = 'Ban raha hai…';

    try {
      const r = await fetch('https://memora-creations.onrender.com/api/admin/backup/download', { credentials: 'include' });

      if (!r.ok) throw new Error('Backup download nahi hua.');

      const url = URL.createObjectURL(await r.blob());
      const a = Object.assign(document.createElement('a'), { href: url, download: 'memora-backup-' + new Date().toISOString().slice(0, 10) + '.json' });

      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      message('Backup download ho gaya.', true);
    } catch (e) {
      message(e.message, false);
    }

    btn.disabled = false;
    btn.textContent = '⬇ Backup abhi download karo';
  });

  async function load() {
    try {
      const data = await api('/admin/settings');

      fill(data.settings || {});
      showMail(data.mailConfigured);
      showChat(data.chatConfigured);

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

    if (!body.storeOpen && !(await window.mcConfirm('The store will be CLOSED: customers cannot place orders. Continue?', { title: 'Store band karna hai?', okText: 'Haan, band karo', danger: true }))) {
      return;
    }

    const button = $('#stSave');

    button.disabled = true;

    try {
      const data = await api('/admin/settings', { method: 'PUT', body: JSON.stringify(body) });

      fill(data.settings || {});
      showMail(data.mailConfigured);
      showChat(data.chatConfigured);
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


  // Shiprocket connection check (moved here from the Dashboard).
  $('#testShiprocket')?.addEventListener('click', async () => {
    const out = $('#shiprocketResult');
    out.textContent = 'Testing Shiprocket connection...';
    try {
      const data = await api('/admin/shiprocket/test');
      out.textContent = '✅ ' + (data.message || 'Shiprocket connected.');
    } catch (e) {
      out.textContent = '❌ ' + (e.message || 'Shiprocket connection failed.');
    }
  });


  /* =========================
     2-STEP LOGIN
  ========================= */

  const tf = {
    state: $('#tfState'), start: $('#tfStart'), stop: $('#tfStop'),
    setup: $('#tfSetup'), codes: $('#tfCodes')
  };

  async function loadTwoFactor() {
    if (!tf.state) return;

    try {
      const s = await api('/admin/2fa/status');

      tf.state.innerHTML = s.enabled
        ? `✅ <b>Chalu hai.</b> Recovery codes bache: ${s.recoveryLeft}` + (s.emergencyOff ? '<br>⚠️ Render me ADMIN_2FA_DISABLE=true laga hai, isliye abhi code nahi maanga ja raha.' : '')
        : '⚠️ <b>Band hai.</b> Sirf password se login hota hai.';
      tf.start.hidden = s.enabled;
      tf.stop.hidden = !s.enabled;
    } catch (e) {
      tf.state.textContent = e.message || 'Status nahi mila.';
    }
  }

  function loadQrLibrary() {
    return new Promise(resolve => {
      if (window.QRCode) return resolve(true);

      const script = document.createElement('script');

      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }

  tf.start?.addEventListener('click', async () => {
    tf.start.disabled = true;

    try {
      const d = await api('/admin/2fa/setup', { method: 'POST', body: '{}' });

      $('#tfKey').textContent = d.secret;
      $('#tfQr').innerHTML = '';
      tf.setup.hidden = false;

      if (await loadQrLibrary()) new window.QRCode($('#tfQr'), { text: d.otpauth, width: 180, height: 180 });
      else $('#tfQr').textContent = 'QR nahi bana: upar ki key app me khud type karein.';
    } catch (e) {
      toast(e.message || 'Shuru nahi hua.', 'error');
    } finally {
      tf.start.disabled = false;
    }
  });

  $('#tfEnable')?.addEventListener('click', async () => {
    try {
      const d = await api('/admin/2fa/enable', { method: 'POST', body: JSON.stringify({ code: $('#tfCode').value }) });

      tf.setup.hidden = true;
      $('#tfCodeList').textContent = d.recoveryCodes.join('\n');
      tf.codes.hidden = false;
      toast(d.message, 'success');
      loadTwoFactor();
    } catch (e) {
      toast(e.message || 'Code galat.', 'error');
    }
  });

  $('#tfCopy')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText($('#tfCodeList').textContent);
      toast('Recovery codes copy ho gaye.', 'success');
    } catch (_) {
      toast('Copy nahi hua: codes ko select karke copy karein.', 'warning');
    }
  });

  tf.stop?.addEventListener('click', async () => {
    const password = await window.mcPrompt('Apna admin password daalein.', { title: '2-step login band karna hai?', okText: 'Aage badho' });

    if (password === null) return;

    const code = await window.mcPrompt('Authenticator ka 6 digit code (ya recovery code) daalein.', { title: 'Code daalein', okText: 'Band karo' });

    if (code === null) return;

    try {
      const d = await api('/admin/2fa/disable', { method: 'POST', body: JSON.stringify({ password, code }) });

      toast(d.message, 'success');
      tf.codes.hidden = true;
      loadTwoFactor();
    } catch (e) {
      toast(e.message || 'Band nahi hua.', 'error');
    }
  });

  loadTwoFactor();

})();
