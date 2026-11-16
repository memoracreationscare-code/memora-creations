/* Service worker: makes the site installable and shows push notifications.
   It caches nothing, so customers always get the latest prices, stock and orders. */
const API_BASE = 'https://api.memoracreationscare.in/api';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});

/* The push itself carries no text; we fetch the latest message from the shop. */
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let msg = null;

    try {
      const sub = await self.registration.pushManager.getSubscription();
      const q = sub ? '?e=' + encodeURIComponent(sub.endpoint) : '';
      const res = await fetch(API_BASE + '/push/latest' + q, { cache: 'no-store' });
      const data = await res.json();
      msg = data && data.message;
    } catch (_) { /* show the default text below */ }

    await self.registration.showNotification(
      (msg && msg.title) || 'Memora Creations',
      {
        body: (msg && msg.body) || 'Naye offers aur products dekhne ke liye tap karein.',
        icon: '/frontend/images/favicon-192.png',
        badge: '/frontend/images/favicon-192.png',
        tag: 'memora-offer',
        renotify: true,
        data: { url: (msg && msg.url) || '/frontend/index.html' }
      }
    );
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/frontend/index.html';
  const target = new URL(url, self.location.origin).href;

  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    for (const c of all) {
      if ('focus' in c) {
        try { await c.navigate(target); } catch (_) { /* ignore */ }
        return c.focus();
      }
    }

    return self.clients.openWindow(target);
  })());
});
