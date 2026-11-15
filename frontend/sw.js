/* Minimal service worker: makes the site installable. It caches nothing,
   so customers always get the latest prices, stock and orders. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
