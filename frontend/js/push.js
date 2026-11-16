/* Offers & order-update notifications: asks once, politely, on the home page. */
(() => {
  'use strict';

  const API = 'https://api.memoracreationscare.in/api';
  const KEY = 'mc_push_later';
  const supported =
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;

  if (!supported) return;

  const toBytes = b64 => {
    const pad = '='.repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, c => c.charCodeAt(0));
  };

  async function subscribe() {
    const reg = await navigator.serviceWorker.register('/frontend/sw.js', { scope: '/frontend/' });
    await navigator.serviceWorker.ready;

    const keyRes = await fetch(API + '/push/key');
    const { publicKey } = await keyRes.json();
    if (!publicKey) throw new Error('no key');

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toBytes(publicKey)
      });
    }

    await fetch(API + '/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON() })
    });
  }

  function laterActive() {
    try {
      return Date.now() < Number(localStorage.getItem(KEY) || 0);
    } catch (_) {
      return false;
    }
  }

  function later(days) {
    try {
      localStorage.setItem(KEY, String(Date.now() + days * 86400000));
    } catch (_) { /* ignore */ }
  }

  function show() {
    const css = document.createElement('style');
    css.textContent = `
      #mcPush{position:fixed;left:12px;right:12px;bottom:92px;z-index:9990;max-width:420px;margin:0 auto;background:#fff;border:1px solid #eadfd4;border-radius:16px;box-shadow:0 14px 40px rgba(48,33,23,.22);padding:14px 16px;display:flex;gap:12px;align-items:center;font-family:inherit}
      #mcPush .t{flex:1;font-size:14px;line-height:1.4;color:#302117}
      #mcPush .t b{display:block;font-size:15px;margin-bottom:2px}
      #mcPush button{border:0;border-radius:10px;padding:10px 14px;font-weight:700;font-size:13px;cursor:pointer}
      #mcPush .go{background:#805137;color:#fff}
      #mcPush .no{background:transparent;color:#7a6a5e;padding:10px 6px}`;
    document.head.appendChild(css);

    const box = document.createElement('div');
    box.id = 'mcPush';
    box.setAttribute('role', 'dialog');
    box.innerHTML =
      '<div class="t"><b>🔔 Offers ka notification</b>Naye offers aur sale sabse pehle paayein.</div>' +
      '<button class="go" type="button">Allow</button>' +
      '<button class="no" type="button">Baad me</button>';
    document.body.appendChild(box);

    box.querySelector('.no').onclick = () => { later(7); box.remove(); };
    box.querySelector('.go').onclick = async () => {
      box.remove();
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') await subscribe();
        else later(30);
      } catch (_) { later(1); }
    };
  }

  async function start() {
    if (Notification.permission === 'granted') {
      /* already allowed: quietly make sure this phone is saved (once a day) */
      try {
        if (Date.now() - Number(localStorage.getItem('mc_push_sync') || 0) < 86400000) return;
        localStorage.setItem('mc_push_sync', String(Date.now()));
      } catch (_) { /* ignore */ }
      subscribe().catch(() => {});
      return;
    }
    if (Notification.permission === 'denied' || laterActive()) return;
    setTimeout(show, 9000);
  }

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
})();
