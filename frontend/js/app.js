
/*
=========================================
 MEMORA CREATIONS
 COMMON FRONTEND APP

 Login, Navigation, Cart, Search,
 Wishlist and Account Functions

 FIX:
 No false logout on slow Render backend.
=========================================
*/

const API =
  'https://memora-creations.onrender.com/api';

const BASE =
  '/memora-creations';

const $ = (selector, root = document) =>
  root.querySelector(selector);

const $$ = (selector, root = document) =>
  [...root.querySelectorAll(selector)];


/* =====================================
   API ERROR
===================================== */

class ApiError extends Error {
  constructor(
    message,
    {
      status = 0,
      code = 'UNKNOWN_ERROR'
    } = {}
  ) {
    super(message);

    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}


/* =====================================
   API REQUEST
===================================== */

async function api(path, options = {}) {
  if (
    typeof navigator !== 'undefined' &&
    navigator.onLine === false
  ) {
    throw new ApiError(
      'Internet connection check karein.',
      { code: 'OFFLINE' }
    );
  }

  let response;

  try {
    response = await fetch(API + path, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    });
  } catch (error) {
    console.error('API network error:', error);

    throw new ApiError(
      'Server se connection nahi ho pa raha hai. Internet check karke dobara try karein.',
      {
        code:
          error?.name === 'AbortError'
            ? 'REQUEST_ABORTED'
            : 'NETWORK_ERROR'
      }
    );
  }

  let data = {};

  try {
    const text = await response.text();

    if (text) {
      try {
        data = JSON.parse(text);
      } catch (_) {
        data = {};
      }
    }
  } catch (_) {
    data = {};
  }

  if (!response.ok) {
    const errors = {
      400: 'Request sahi nahi hai.',
      401: 'Session expire ho gaya hai. Please login again.',
      403: 'Aapko is action ki permission nahi hai.',
      404: 'Requested information nahi mili.',
      409: 'Request conflict ho raha hai.',
      429: 'Bahut zyada requests ho gayi hain.'
    };

    const fallback =
      errors[response.status] ||
      (
        response.status >= 500
          ? 'Server me temporary problem hai.'
          : 'Something went wrong. Please try again.'
      );

    throw new ApiError(
      data.message || fallback,
      {
        status: response.status,
        code:
          response.status === 401
            ? 'UNAUTHORIZED'
            : 'HTTP_ERROR'
      }
    );
  }

  return data;
}


/* =====================================
   MONEY FORMAT
===================================== */

function money(value) {
  return `₹${Number(value || 0).toLocaleString(
    'en-IN',
    { maximumFractionDigits: 2 }
  )}`;
}


/* =====================================
   HTML ESCAPE
===================================== */

function esc(value) {
  return String(value ?? '').replace(
    /[&<>'"]/g,
    character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[character])
  );
}


/* =====================================
   TOAST MESSAGE
===================================== */

function toast(message, type = 'message') {
  // Admin pages define a nicer floating toast (admin/js/nav.js).
  if (typeof window.mcToast === 'function') return window.mcToast(message, type);

  document.querySelector('.message')?.remove();

  const element = document.createElement('div');

  element.className = `message ${type}`;
  element.textContent = message;

  document.body.prepend(element);

  setTimeout(() => {
    element.remove();
  }, 3500);
}


/* =====================================
   ADD TO CART SUCCESS POPUP
===================================== */

function showCartPopup() {
  document.querySelector('#cartSuccessPopup')?.remove();

  const overlay = document.createElement('div');

  overlay.id = 'cartSuccessPopup';
  overlay.className = 'modal show';

  overlay.innerHTML = `
    <div
      class="modalbox"
      style="max-width:420px;text-align:center"
    >
      <div style="font-size:52px;margin-bottom:10px">
        ✅
      </div>

      <h2 style="margin:0 0 10px">
        Added to Cart
      </h2>

      <p class="muted">
        Product successfully cart me add ho gaya hai.
      </p>

      <div
        class="actions"
        style="justify-content:center;margin-top:20px"
      >
        <button
          class="btn secondary cart-popup-close"
          type="button"
        >
          Continue Shopping
        </button>

        <a
          class="btn"
          href="${BASE}/frontend/cart.html"
        >
          View Cart
        </a>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay
    .querySelector('.cart-popup-close')
    ?.addEventListener('click', () => {
      overlay.remove();
    });

  overlay.addEventListener('click', event => {
    if (event.target === overlay) {
      overlay.remove();
    }
  });
}


/* =====================================
   SHARED CURRENT USER REQUEST

   Render Free backend may wake slowly.
   Never interpret a 4-second delay
   as proof that the user logged out.

   Failed network requests are not cached
   permanently within the page.
===================================== */

let mcCurrentUserPromise = null;

async function currentUser() {
  if (mcCurrentUserPromise) {
    return mcCurrentUserPromise;
  }

  const request = (async () => {
    try {
      const data = await api('/auth/me');

      return data.user || null;

    } catch (error) {
      if (
        error?.status === 401 ||
        error?.code === 'UNAUTHORIZED'
      ) {
        return null;
      }

      console.warn(
        'Current user check unavailable:',
        error.message
      );

      // Backend/network failure must not
      // be treated as a confirmed logout.
      throw error;
    }
  })();

  mcCurrentUserPromise = request;

  try {
    return await request;
  } catch (error) {
    mcCurrentUserPromise = null;
    throw error;
  }
}


/* =====================================
   REQUIRE LOGIN

   Redirect only when login is
   actually missing or expired.
===================================== */

async function requireLogin() {
  try {
    const data = await api('/auth/me');

    if (data.user) {
      return data.user;
    }

    location.href =
      BASE +
      '/frontend/login.html?next=' +
      encodeURIComponent(
        location.pathname + location.search
      );

    return null;

  } catch (error) {
    if (
      error?.status === 401 ||
      error?.code === 'UNAUTHORIZED'
    ) {
      location.href =
        BASE +
        '/frontend/login.html?next=' +
        encodeURIComponent(
          location.pathname + location.search
        );

      return null;
    }

    console.error('Login check error:', error);

    toast(
      error?.message ||
      'Account verify nahi ho pa raha hai.',
      'error'
    );

    return null;
  }
}


/* =====================================
   LOGOUT
===================================== */

async function logoutUser() {
  const button = $('#logoutBtn');
  const oldText = button?.textContent;

  if (button) {
    button.disabled = true;
    button.textContent = 'Logging out...';
  }

  try {
    await api('/auth/logout', {
      method: 'POST'
    });

    mcCurrentUserPromise = null;

    location.href =
      BASE + '/frontend/login.html';

  } catch (error) {
    console.error('Logout error:', error);

    toast(
      error?.message || 'Logout nahi ho pa raha hai.',
      'error'
    );

    if (button) {
      button.disabled = false;
      button.textContent = oldText || 'Logout';
    }
  }
}


/* =====================================
   DESKTOP NAVIGATION
===================================== */

async function nav() {
  const element = $('#nav');

  if (!element) return;

  /*
   Display basic navigation immediately.
   This does not require Render backend.
  */

  element.innerHTML = `
    <div class="container nav">
      <a
        class="brand"
        href="${BASE}/frontend/index.html"
        aria-label="Memora Creations home"
      >
        <img
          class="brand-logo"
          src="${BASE}/frontend/images/logo.png"
          alt="Memora Creations logo"
          width="52"
          height="52"
          decoding="async"
        >
        <span class="brand-text">MEMORA CREATIONS</span>
      </a>

      <form class="search" id="globalSearch">
        <input
          class="input"
          placeholder="Search products..."
          name="q"
          autocomplete="off"
        >

        <button class="btn" type="submit">
          Search
        </button>
      </form>

      <div class="navlinks" id="mcDesktopNavLinks">
        <a href="${BASE}/frontend/index.html">
          Home
        </a>

        <a href="${BASE}/frontend/products.html">
          Products
        </a>

        <span class="muted" aria-live="polite">
          Checking account...
        </span>
      </div>
    </div>
  `;

  const searchForm = $('#globalSearch');

  searchForm?.addEventListener('submit', event => {
    event.preventDefault();

    const query = String(
      new FormData(event.currentTarget).get('q') || ''
    ).trim();

    location.href =
      BASE +
      '/frontend/products.html?q=' +
      encodeURIComponent(query);
  });

  let user;

  try {
    user = await currentUser();
  } catch (error) {
    const links = $('#mcDesktopNavLinks');

    if (links) {
      links.innerHTML = `
        <a href="${BASE}/frontend/index.html">
          Home
        </a>

        <a href="${BASE}/frontend/products.html">
          Products
        </a>

        <span class="muted" aria-live="polite">
          Account temporarily unavailable
        </span>

        <button
          class="btn secondary"
          id="mcRetryNav"
          type="button"
        >
          Retry
        </button>
      `;

      $('#mcRetryNav')?.addEventListener(
        'click',
        () => {
          mcCurrentUserPromise = null;
          nav();
          bottomNav();
        }
      );
    }

    return;
  }

  const links = $('#mcDesktopNavLinks');

  if (!links) return;

  links.innerHTML = `
    <a href="${BASE}/frontend/index.html">
      Home
    </a>

    <a href="${BASE}/frontend/products.html">
      Products
    </a>

    ${
      user
        ? `
          <a
            href="${BASE}/frontend/wishlist.html"
            aria-label="My Wishlist"
          >
            ♥ Wishlist
          </a>

          <a href="${BASE}/frontend/orders.html">
            Orders
          </a>

          <a href="${BASE}/frontend/profile.html">
            Profile
          </a>

          <a href="${BASE}/frontend/cart.html">
            Cart (<span id="cartCount">0</span>)
          </a>

          <button
            class="btn secondary"
            id="logoutBtn"
            type="button"
          >
            Logout
          </button>
        `
        : `
          <a
            class="btn secondary"
            href="${BASE}/frontend/login.html"
          >
            Login
          </a>
        `
    }
  `;

  $('#logoutBtn')?.addEventListener(
    'click',
    logoutUser
  );

  if (user) {
    updateCartCount();
  }
}


/* =====================================
   CART COUNTER
===================================== */

async function updateCartCount() {
  const element = $('#cartCount');

  if (!element) return;

  try {
    const data = await api('/cart');

    const count = (data.cart?.items || [])
      .reduce(
        (total, item) =>
          total + Number(item.quantity || 0),
        0
      );

    element.textContent = count;

  } catch (error) {
    console.warn('Cart count unavailable:', error);

    if (element) {
      element.textContent = '0';
    }
  }
}


/* =====================================
   MOBILE BOTTOM NAVIGATION
===================================== */

async function bottomNav() {
  const element = $('#bottomNav');

  if (!element) return;

  document.body.classList.add('has-bottomnav');

  const path = location.pathname.toLowerCase();

  const active = page =>
    path.includes(page) ? 'active' : '';

  const homeLink = `
    <a
      href="${BASE}/frontend/index.html"
      class="${active('/frontend/index.html')}"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M3 10.5L12 3l9 7.5"></path>
        <path d="M5 9.5V20h14V9.5"></path>
      </svg>
      <span>Home</span>
    </a>
  `;

  const productsLink = `
    <a
      href="${BASE}/frontend/products.html"
      class="${active('/frontend/products.html')}"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="3" y="3" width="7" height="7" rx="1"></rect>
        <rect x="14" y="3" width="7" height="7" rx="1"></rect>
        <rect x="3" y="14" width="7" height="7" rx="1"></rect>
        <rect x="14" y="14" width="7" height="7" rx="1"></rect>
      </svg>
      <span>Products</span>
    </a>
  `;

  // Home and Products are available
  // even if the backend is waking up.

  element.innerHTML =
    homeLink +
    productsLink +
    `
      <span
        class="mc-account-loading"
        aria-live="polite"
        style="font-size:11px;text-align:center"
      >
        Loading...
      </span>
    `;

  let user;

  try {
    user = await currentUser();
  } catch (error) {
    element.innerHTML =
      homeLink +
      productsLink +
      `
        <button
          id="mcRetryMobile"
          type="button"
          style="
            border:0;
            background:transparent;
            font-size:11px;
            color:inherit;
          "
        >
          Retry
        </button>
      `;

    $('#mcRetryMobile')?.addEventListener(
      'click',
      () => {
        mcCurrentUserPromise = null;
        nav();
        bottomNav();
      }
    );

    return;
  }

  element.innerHTML = `
    ${homeLink}
    ${productsLink}

    ${
      user
        ? `
          <a
            href="${BASE}/frontend/cart.html"
            class="${active('/frontend/cart.html')}"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="9" cy="20" r="1"></circle>
              <circle cx="18" cy="20" r="1"></circle>
              <path d="M3 4h2l2 11h11l2-8H7"></path>
            </svg>
            <span>Cart</span>
          </a>

          <a
            href="${BASE}/frontend/orders.html"
            class="${active('/frontend/orders.html')}"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M8 6h13"></path>
              <path d="M8 12h13"></path>
              <path d="M8 18h13"></path>
              <path d="M3 6h.01"></path>
              <path d="M3 12h.01"></path>
              <path d="M3 18h.01"></path>
            </svg>
            <span>Orders</span>
          </a>

          <a
            href="${BASE}/frontend/wishlist.html"
            class="${active('/frontend/wishlist.html')}"
            aria-label="My Wishlist"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M20.8 4.6a5.6 5.6 0 0 0-7.9 0L12 5.5l-.9-.9a5.6 5.6 0 1 0-7.9 7.9L12 21l8.8-8.5a5.6 5.6 0 0 0 0-7.9Z"></path>
            </svg>
            <span>Wishlist</span>
          </a>

          <a
            href="${BASE}/frontend/profile.html"
            class="${active('/frontend/profile.html')}"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="8" r="4"></circle>
              <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"></path>
            </svg>
            <span>Profile</span>
          </a>
        `
        : `
          <a
            href="${BASE}/frontend/login.html"
            class="${active('/frontend/login.html')}"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="8" r="4"></circle>
              <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"></path>
            </svg>
            <span>Login</span>
          </a>
        `
    }
  `;
}


/* =====================================
   START
===================================== */

function startNavigation() {
  Promise.all([
    nav(),
    bottomNav()
  ]).catch(error => {
    console.error(
      'Navigation initialization error:',
      error
    );
  });
}

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    startNavigation,
    { once: true }
  );
} else {
  startNavigation();
}


/* =====================================
   GLOBAL EXPORTS
===================================== */

window.MC = {
  api,
  $,
  $$,
  money,
  esc,
  toast,
  showCartPopup,
  currentUser,
  requireLogin,
  updateCartCount,
  logoutUser,
  ApiError
};
