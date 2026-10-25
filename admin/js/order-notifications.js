
/*
=========================================
 MEMORA CREATIONS
 ADMIN ORDER NOTIFICATIONS

 FEATURES:
 - Today's Orders
 - Unseen Orders
 - New Order Sound Alert
 - Persistent Sound ON/OFF
 - Auto Audio Resume
 - Mark as Seen
 - View Orders
 - Auto Refresh Every 30 Seconds

 SOUND RULE:
 Sound preference stays ON until
 the admin manually switches it OFF.
=========================================
*/

(function () {
  'use strict';

  const ORDERS_URL =
    '/memora-creations/admin/orders.html';

  const STORAGE_KEY =
    'mc_admin_orders_seen_v1';

  const SOUND_KEY =
    'mc_admin_notification_sound_v1';

  const POLL_INTERVAL = 30000;

  let orders = [];
  let previousIds = null;
  let loading = false;
  let audioContext = null;
  let soundUnlocked = false;
  let unlockPending = false;

  /* =====================================
     PERSISTENT SOUND PREFERENCE
  ===================================== */

  function readSoundPreference() {
    try {
      return localStorage.getItem(
        SOUND_KEY
      ) === 'true';
    } catch (_) {
      return false;
    }
  }

  let soundEnabled = readSoundPreference();

  function saveSoundPreference(enabled) {
    soundEnabled = Boolean(enabled);

    try {
      localStorage.setItem(
        SOUND_KEY,
        String(soundEnabled)
      );
    } catch (error) {
      console.warn(
        'Could not save sound preference:',
        error
      );
    }

    updateSoundButton();
  }

  /* =====================================
     ELEMENT HELPER
  ===================================== */

  function make(tag, value) {
    const element =
      document.createElement(tag);

    if (value !== undefined) {
      element.textContent = String(value);
    }

    return element;
  }

  /* =====================================
     INDIA DATE
  ===================================== */

  function indianDate(value) {
    const date = new Date(value);

    if (!Number.isFinite(date.getTime())) {
      return '';
    }

    const parts = new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }
    ).formatToParts(date);

    const get = type =>
      parts.find(
        part => part.type === type
      )?.value || '';

    return (
      get('year') + '-' +
      get('month') + '-' +
      get('day')
    );
  }

  /* =====================================
     SEEN ORDERS
  ===================================== */

  function readSeen() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(
          STORAGE_KEY
        ) || '{}'
      );

      return new Set(
        Array.isArray(saved.ids)
          ? saved.ids.map(String)
          : []
      );
    } catch (_) {
      return new Set();
    }
  }

  function markSeen() {
    try {
      const seen = readSeen();

      orders.forEach(order => {
        if (order._id) {
          seen.add(String(order._id));
        }
      });

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ids: [...seen].slice(-1000),
          updatedAt:
            new Date().toISOString()
        })
      );

      render();

    } catch (error) {
      showStatus(
        'Browser storage unavailable.'
      );
    }
  }

  /* =====================================
     SOUND ENGINE
  ===================================== */

  function getAudioContextClass() {
    return (
      window.AudioContext ||
      window.webkitAudioContext
    );
  }

  async function unlockAudio() {
    if (!soundEnabled) {
      return false;
    }

    if (unlockPending) {
      return false;
    }

    const AudioContextClass =
      getAudioContextClass();

    if (!AudioContextClass) {
      soundUnlocked = false;
      updateSoundButton();
      return false;
    }

    unlockPending = true;

    try {
      if (!audioContext ||
          audioContext.state === 'closed') {
        audioContext =
          new AudioContextClass();
      }

      if (audioContext.state !== 'running') {
        await audioContext.resume();
      }

      soundUnlocked =
        audioContext.state === 'running';

      return soundUnlocked;

    } catch (error) {
      soundUnlocked = false;

      console.warn(
        'Audio activation blocked:',
        error
      );

      return false;

    } finally {
      unlockPending = false;
      updateSoundButton();
    }
  }

  function playTone(
    frequency,
    delay,
    duration
  ) {
    if (
      !audioContext ||
      audioContext.state !== 'running'
    ) {
      return;
    }

    const oscillator =
      audioContext.createOscillator();

    const gain =
      audioContext.createGain();

    const startTime =
      audioContext.currentTime + delay;

    oscillator.type = 'sine';

    oscillator.frequency.setValueAtTime(
      frequency,
      startTime
    );

    gain.gain.setValueAtTime(
      0.0001,
      startTime
    );

    gain.gain.exponentialRampToValueAtTime(
      0.18,
      startTime + 0.025
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      startTime + duration
    );

    oscillator.connect(gain);

    gain.connect(
      audioContext.destination
    );

    oscillator.start(startTime);

    oscillator.stop(
      startTime + duration + 0.02
    );
  }

  function playNotificationSound() {
    if (!soundEnabled) {
      return;
    }

    if (
      !audioContext ||
      audioContext.state !== 'running'
    ) {
      soundUnlocked = false;
      updateSoundButton();
      return;
    }

    soundUnlocked = true;

    try {
      playTone(660, 0, 0.18);
      playTone(880, 0.20, 0.18);
      playTone(1046, 0.42, 0.30);

    } catch (error) {
      console.error(
        'Notification sound failed:',
        error
      );
    }
  }

  /* =====================================
     SOUND BUTTON
  ===================================== */

  function updateSoundButton() {
    const button = document.getElementById(
      'mcNotificationSoundButton'
    );

    if (!button) return;

    if (soundEnabled) {
      if (soundUnlocked) {
        button.textContent =
          '🔊 Sound ON';

        button.title =
          'Click to mute notification sound';

      } else {
        button.textContent =
          '🔊 Sound ON';

        button.title =
          'Sound preference is ON. ' +
          'Browser audio may activate ' +
          'after your next interaction.';
      }

      button.style.background =
        '#e8f7ee';

      button.style.color =
        '#166534';

      button.setAttribute(
        'aria-pressed',
        'true'
      );

    } else {
      button.textContent =
        '🔇 Sound OFF';

      button.title =
        'Click to enable notification sound';

      button.style.background =
        '#f0f0f0';

      button.style.color =
        '#555';

      button.setAttribute(
        'aria-pressed',
        'false'
      );
    }
  }

  /* =====================================
     MANUAL SOUND CONTROL
  ===================================== */

  async function toggleSound() {
    const button = document.getElementById(
      'mcNotificationSoundButton'
    );

    if (button) {
      button.disabled = true;
    }

    try {
      /*
        If sound is already enabled
        but browser audio is not active,
        first click activates audio.

        It does NOT switch preference OFF.
      */

      if (soundEnabled && !soundUnlocked) {
        const active = await unlockAudio();

        if (active) {
          playNotificationSound();

          notify(
            'Notification sound activated!',
            'success'
          );
        } else {
          notify(
            'Sound is ON. Click again ' +
            'if browser audio is blocked.',
            'error'
          );
        }

        return;
      }

      /*
        Only an explicit button click
        can switch Sound OFF.
      */

      if (soundEnabled) {
        saveSoundPreference(false);

        notify(
          'Notification sound muted.',
          'success'
        );

        return;
      }

      /*
        Manual enabling.
      */

      saveSoundPreference(true);

      const active = await unlockAudio();

      if (active) {
        playNotificationSound();

        notify(
          'Notification sound enabled!',
          'success'
        );
      } else {
        notify(
          'Sound preference saved as ON. ' +
          'Browser audio needs activation.',
          'error'
        );
      }

    } finally {
      if (button) {
        button.disabled = false;
      }

      updateSoundButton();
    }
  }

  function notify(message, type) {
    if (
      window.MC &&
      typeof window.MC.toast === 'function'
    ) {
      window.MC.toast(
        message,
        type || 'success'
      );
    }
  }

  /* =====================================
     RESTORE AUDIO AFTER TAB CHANGE
  ===================================== */

  function attemptAudioRestore() {
    if (!soundEnabled) return;

    /*
      Do not modify localStorage here.
      Browser audio state and user
      preference are separate things.
    */

    unlockAudio().catch(error => {
      console.warn(
        'Audio resume error:',
        error
      );
    });
  }

  /*
    When admin interacts with the page,
    browser may permit audio again.

    Ignore the sound button here,
    because it handles its own clicks.
  */

  function onUserInteraction(event) {
    if (!soundEnabled) return;

    const button = document.getElementById(
      'mcNotificationSoundButton'
    );

    if (
      button &&
      (
        event.target === button ||
        button.contains(event.target)
      )
    ) {
      return;
    }

    if (
      soundUnlocked &&
      audioContext &&
      audioContext.state === 'running'
    ) {
      return;
    }

    attemptAudioRestore();
  }

  document.addEventListener(
    'pointerdown',
    onUserInteraction,
    true
  );

  document.addEventListener(
    'keydown',
    onUserInteraction,
    true
  );

  document.addEventListener(
    'visibilitychange',
    function () {
      if (!document.hidden) {
        attemptAudioRestore();
        checkOrders();
      }
    }
  );

  window.addEventListener(
    'focus',
    attemptAudioRestore
  );

  /*
    Keep preference in sync
    across open browser tabs.
  */

  window.addEventListener(
    'storage',
    function (event) {
      if (event.key !== SOUND_KEY) {
        return;
      }

      soundEnabled =
        event.newValue === 'true';

      updateSoundButton();

      if (soundEnabled) {
        attemptAudioRestore();
      }
    }
  );

  /* =====================================
     STATUS TEXT
  ===================================== */

  function showStatus(message) {
    const status = document.getElementById(
      'mcAdminNotificationStatus'
    );

    if (status) {
      status.textContent = message;
    }
  }

  /* =====================================
     RENDER ORDER SUMMARY
  ===================================== */

  function render() {
    const badge = document.getElementById(
      'mcAdminNotificationBadge'
    );

    if (!badge) return;

    const seen = readSeen();

    const unseen = orders.filter(
      order =>
        order._id &&
        !seen.has(String(order._id))
    );

    const today = indianDate(new Date());

    const todayOrders = orders.filter(
      order =>
        indianDate(order.createdAt) === today
    );

    badge.textContent =
      unseen.length + ' New';

    badge.style.background =
      unseen.length > 0
        ? '#b45309'
        : '#777';

    const latest = todayOrders
      .slice()
      .sort(
        (a, b) =>
          new Date(b.createdAt) -
          new Date(a.createdAt)
      )[0];

    const latestText = latest
      ? ' Latest: ' +
        String(
          latest.orderId || 'New Order'
        )
      : '';

    showStatus(
      'Aaj ' +
      todayOrders.length +
      ' order(s) aaye hain. ' +
      'Unseen: ' +
      unseen.length +
      '.' +
      latestText
    );

    updateSoundButton();
  }

  /* =====================================
     CREATE NOTIFICATION BAR
  ===================================== */

  function buildBar() {
    if (
      document.getElementById(
        'mcAdminNotifications'
      )
    ) {
      return;
    }

    const bar = make('section');

    bar.id =
      'mcAdminNotifications';

    bar.setAttribute(
      'aria-label',
      'Admin order notifications'
    );

    bar.style.cssText = [
      'max-width:1200px',
      'margin:18px auto',
      'padding:15px 18px',
      'background:#fff8ee',
      'border:1px solid #e8ceb2',
      'border-radius:14px',
      'display:flex',
      'align-items:center',
      'justify-content:space-between',
      'gap:14px',
      'flex-wrap:wrap',
      'box-shadow:0 5px 20px #3021170a'
    ].join(';');

    const info = make('div');

    const heading = make(
      'strong',
      '🔔 Order Notifications'
    );

    heading.style.cssText =
      'display:block;' +
      'color:#302117;' +
      'font-size:16px';

    const status = make(
      'p',
      'Checking new orders...'
    );

    status.id =
      'mcAdminNotificationStatus';

    status.setAttribute(
      'aria-live',
      'polite'
    );

    status.style.cssText =
      'margin:7px 0 0;' +
      'color:#805e43;' +
      'font-size:13px';

    info.append(
      heading,
      status
    );

    const controls = make('div');

    controls.style.cssText = [
      'display:flex',
      'align-items:center',
      'gap:10px',
      'flex-wrap:wrap'
    ].join(';');

    /* NEW ORDER COUNT */

    const badge = make(
      'span',
      '0 New'
    );

    badge.id =
      'mcAdminNotificationBadge';

    badge.style.cssText = [
      'background:#777',
      'color:white',
      'padding:8px 12px',
      'border-radius:30px',
      'font-weight:800',
      'font-size:12px'
    ].join(';');

    /* PERSISTENT SOUND BUTTON */

    const soundButton = make(
      'button',
      '🔇 Sound OFF'
    );

    soundButton.id =
      'mcNotificationSoundButton';

    soundButton.type = 'button';

    soundButton.style.cssText = [
      'border:1px solid #dcc1a7',
      'border-radius:10px',
      'padding:10px 12px',
      'font-weight:800',
      'font-size:12px',
      'cursor:pointer'
    ].join(';');

    soundButton.addEventListener(
      'click',
      toggleSound
    );

    /* MARK AS SEEN */

    const markButton = make(
      'button',
      'Mark as Seen'
    );

    markButton.type = 'button';

    markButton.style.cssText = [
      'border:1px solid #ddc2a8',
      'background:#f3e5d8',
      'color:#543521',
      'border-radius:10px',
      'padding:10px 12px',
      'font-weight:700',
      'font-size:12px',
      'cursor:pointer'
    ].join(';');

    markButton.addEventListener(
      'click',
      markSeen
    );

    /* VIEW ORDERS */

    const link = make(
      'a',
      'View Orders →'
    );

    link.href = ORDERS_URL;

    link.style.cssText = [
      'background:#302117',
      'color:white',
      'padding:11px 15px',
      'border-radius:10px',
      'font-weight:700',
      'font-size:12px',
      'text-decoration:none'
    ].join(';');

    controls.append(
      badge,
      soundButton,
      markButton,
      link
    );

    bar.append(
      info,
      controls
    );

    const nav = document.querySelector(
      '.adminnav'
    );

    if (nav) {
      nav.insertAdjacentElement(
        'afterend',
        bar
      );
    } else {
      document.body.prepend(bar);
    }

    updateSoundButton();
  }

  /* =====================================
     CHECK NEW ORDERS
  ===================================== */

  async function checkOrders() {
    if (
      loading ||
      document.hidden
    ) {
      return;
    }

    loading = true;

    try {
      const result = await window.MC.api(
        '/admin/orders'
      );

      if (!Array.isArray(result.orders)) {
        throw new Error(
          'Invalid orders response.'
        );
      }

      orders = result.orders;

      const ids = new Set(
        orders
          .filter(order => order._id)
          .map(
            order => String(order._id)
          )
      );

      /*
        First check establishes baseline.
        Do not alert for existing orders.
      */

      if (previousIds !== null) {
        const fresh = orders.filter(
          order =>
            order._id &&
            !previousIds.has(
              String(order._id)
            )
        );

        if (fresh.length > 0) {
          notify(
            '🔔 ' +
            fresh.length +
            ' new customer order(s)!',
            'success'
          );

          playNotificationSound();
        }
      }

      previousIds = ids;

      render();

    } catch (error) {
      showStatus(
        'Orders notification check failed. ' +
        'Refresh or login again.'
      );

      console.error(
        'Admin notification error:',
        error
      );

    } finally {
      loading = false;
    }
  }

  /* =====================================
     START NOTIFICATION SYSTEM
  ===================================== */

  async function start() {
    if (
      !window.MC ||
      typeof window.MC.api !== 'function' ||
      typeof window.requireAdmin !== 'function'
    ) {
      return;
    }

    const admin =
      await window.requireAdmin();

    if (!admin) return;

    buildBar();

    /*
      Restore saved Sound ON preference.
      Never reset it on page reload.
    */

    if (soundEnabled) {
      attemptAudioRestore();
    }

    await checkOrders();

    window.setInterval(
      checkOrders,
      POLL_INTERVAL
    );
  }

  start().catch(error => {
    console.error(
      'Notification startup error:',
      error
    );
  });

})();
