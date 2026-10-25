
/*
=========================================
 MEMORA CREATIONS
 ADMIN ORDER NOTIFICATIONS

 FEATURES
 - Today's Orders
 - Unseen Orders
 - New Order Alert
 - Notification Sound
 - Enable / Mute Sound
 - Mark as Seen
 - View Orders
 - Auto Refresh Every 30 Seconds
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

  let soundEnabled = false;

  try {
    soundEnabled =
      localStorage.getItem(SOUND_KEY) === 'true';
  } catch (_) {
    soundEnabled = false;
  }

  /* =====================================
     ELEMENT HELPER
  ===================================== */

  function make(tag, value) {
    const element = document.createElement(tag);

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
      parts.find(p => p.type === type)?.value || '';

    return (
      get('year') + '-' +
      get('month') + '-' +
      get('day')
    );
  }

  /* =====================================
     READ SEEN ORDERS
  ===================================== */

  function readSeen() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || '{}'
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

  /* =====================================
     MARK ORDERS AS SEEN
  ===================================== */

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
          updatedAt: new Date().toISOString()
        })
      );

      render();

    } catch (_) {
      showStatus(
        'Browser storage unavailable.'
      );
    }
  }

  /* =====================================
     SOUND ENGINE

     Sound is generated locally.
     No audio file is required.
  ===================================== */

  async function unlockAudio() {
    const AudioContextClass =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContextClass) {
      throw new Error(
        'Sound is not supported in this browser.'
      );
    }

    if (!audioContext) {
      audioContext = new AudioContextClass();
    }

    if (audioContext.state !== 'running') {
      await audioContext.resume();
    }

    soundUnlocked =
      audioContext.state === 'running';

    if (!soundUnlocked) {
      throw new Error(
        'Browser blocked notification sound.'
      );
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
    gain.connect(audioContext.destination);

    oscillator.start(startTime);

    oscillator.stop(
      startTime + duration + 0.02
    );
  }

  function playNotificationSound() {
    if (
      !soundEnabled ||
      !soundUnlocked ||
      !audioContext ||
      audioContext.state !== 'running'
    ) {
      return;
    }

    try {
      // Three-tone order notification.

      playTone(660, 0, 0.18);

      playTone(880, 0.20, 0.18);

      playTone(1046, 0.42, 0.30);

    } catch (err) {
      console.error(
        'Notification sound failed:',
        err
      );
    }
  }

  /* =====================================
     UPDATE SOUND BUTTON
  ===================================== */

  function updateSoundButton() {
    const button = document.getElementById(
      'mcNotificationSoundButton'
    );

    if (!button) return;

    if (soundEnabled && soundUnlocked) {
      button.textContent = '🔊 Sound ON';

      button.style.background = '#e8f7ee';
      button.style.color = '#166534';

    } else if (soundEnabled) {
      button.textContent = '🔔 Enable Sound';

      button.style.background = '#fff1db';
      button.style.color = '#8c4e2b';

    } else {
      button.textContent = '🔇 Sound OFF';

      button.style.background = '#f0f0f0';
      button.style.color = '#555';
    }
  }

  /* =====================================
     ENABLE / DISABLE SOUND
  ===================================== */

  async function toggleSound() {
    const button = document.getElementById(
      'mcNotificationSoundButton'
    );

    if (button) {
      button.disabled = true;
    }

    try {
      if (soundEnabled && soundUnlocked) {
        soundEnabled = false;
        soundUnlocked = false;

        localStorage.setItem(
          SOUND_KEY,
          'false'
        );

        updateSoundButton();

        window.MC.toast(
          'Notification sound disabled.',
          'success'
        );

        return;
      }

      /*
        Browser requires a user click
        before audio playback.
      */

      await unlockAudio();

      soundEnabled = true;

      localStorage.setItem(
        SOUND_KEY,
        'true'
      );

      updateSoundButton();

      // Play a sample sound immediately.

      playNotificationSound();

      window.MC.toast(
        'Notification sound enabled!',
        'success'
      );

    } catch (err) {
      soundEnabled = false;
      soundUnlocked = false;

      try {
        localStorage.setItem(
          SOUND_KEY,
          'false'
        );
      } catch (_) {}

      updateSoundButton();

      window.MC.toast(
        err.message ||
        'Sound could not be enabled.',
        'error'
      );

    } finally {
      if (button) {
        button.disabled = false;
      }
    }
  }

  /* =====================================
     SHOW STATUS
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
     RENDER NOTIFICATIONS
  ===================================== */

  function render() {
    const badge = document.getElementById(
      'mcAdminNotificationBadge'
    );

    if (!badge) return;

    const seen = readSeen();

    const unseen = orders.filter(order =>
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
        String(latest.orderId || 'New Order')
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
     BUILD NOTIFICATION BAR
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

    bar.id = 'mcAdminNotifications';

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
      'display:block;color:#302117;font-size:16px';

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
      'margin:7px 0 0;color:#805e43;font-size:13px';

    info.append(heading, status);

    const controls = make('div');

    controls.style.cssText = [
      'display:flex',
      'align-items:center',
      'gap:10px',
      'flex-wrap:wrap'
    ].join(';');

    /* NEW ORDERS BADGE */

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

    /* SOUND BUTTON */

    const soundButton = make(
      'button',
      '🔔 Enable Sound'
    );

    soundButton.id =
      'mcNotificationSoundButton';

    soundButton.type = 'button';

    soundButton.style.cssText = [
      'border:1px solid #dcc1a7',
      'background:#fff1db',
      'color:#8c4e2b',
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

    bar.append(info, controls);

    const nav =
      document.querySelector('.adminnav');

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
          .map(order => String(order._id))
      );

      /*
        First load establishes baseline.
        Never play sound for old orders.
      */

      if (previousIds !== null) {
        const fresh = orders.filter(order =>
          order._id &&
          !previousIds.has(String(order._id))
        );

        if (fresh.length > 0) {
          window.MC.toast(
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

    } catch (err) {
      showStatus(
        'Orders notification check failed. ' +
        'Refresh or login again.'
      );

      console.error(
        'Admin notifications error:',
        err
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

    await checkOrders();

    window.setInterval(
      checkOrders,
      POLL_INTERVAL
    );

    document.addEventListener(
      'visibilitychange',
      () => {
        if (!document.hidden) {
          checkOrders();
        }
      }
    );
  }

  start().catch(err => {
    console.error(
      'Notification startup error:',
      err
    );
  });

})();
