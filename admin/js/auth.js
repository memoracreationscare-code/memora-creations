(() => {

  /*
    SPEED: SHARE IDENTICAL REQUESTS
    Several admin scripts (login check, sales analytics,
    new-order alerts) ask for the same data at the same
    moment. Without sharing, the server does the work twice.
    While one request is still running, later identical
    requests wait for it instead of starting their own.
    Each caller gets its own copy, and nothing is cached
    after the answer arrives, so data is never stale.
  */

  const SHARED_PATHS = new Set(['/admin/dashboard', '/admin/orders']);
  const inFlight = new Map();
  const originalApi = window.MC.api;

  function copyOf(value) {
    return typeof structuredClone === 'function'
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value));
  }

  window.MC.api = function sharedApi(path, options) {

    const method = String(options?.method || 'GET').toUpperCase();

    if (method !== 'GET' || !SHARED_PATHS.has(path)) {
      return originalApi(path, options);
    }

    if (!inFlight.has(path)) {
      const request = originalApi(path, options)
        .finally(() => inFlight.delete(path));

      inFlight.set(path, request);
    }

    return inFlight.get(path).then(copyOf);
  };

  const { $, toast } = window.MC;
  const api = window.MC.api;

  $('#adminLogin')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    try {
      await api('/admin/login', {
        method: 'POST',
        body: JSON.stringify(
          Object.fromEntries(new FormData(e.currentTarget))
        )
      });

      location.href = '/memora-creations/admin/dashboard.html';
    } catch (x) {
      toast(x.message, 'error');
    }
  });

  async function requireAdmin() {

    // The free server can take up to a minute to wake up.
    // Tell the owner instead of showing a silent blank page.
    const slowHint = setTimeout(() => {
      toast('Server shuru ho raha hai, 30-60 second ruk kar dekhein...');
    }, 6000);

    try {
      return (await api('/admin/dashboard')).dashboard;
    } catch (e) {
      location.href = '/memora-creations/admin/index.html';
      return null;
    } finally {
      clearTimeout(slowHint);
    }
  }

  $('#logout')?.addEventListener('click', async () => {
    await api('/admin/logout', { method: 'POST' });
    location.href = '/memora-creations/admin/index.html';
  });

  window.requireAdmin = requireAdmin;
})();

// Load the request alerts (red badges + banner) on every admin page.
(() => {
  const script = document.createElement('script');
  script.src = '/memora-creations/admin/js/alerts.js?v=2';
  document.head.appendChild(script);
})();
