const API =
  'https://memora-creations.onrender.com/api';

const BASE =
  '/memora-creations';


const $ =
  (s, r = document) =>
    r.querySelector(s);

const $$ =
  (s, r = document) =>
    [...r.querySelectorAll(s)];


/* =========================
   API ERROR
========================= */

class ApiError extends Error {

  constructor(
    message,
    {
      status = 0,
      code = 'UNKNOWN_ERROR'
    } = {}
  ) {

    super(message);

    this.name =
      'ApiError';

    this.status =
      status;

    this.code =
      code;

  }

}


/* =========================
   API
========================= */

async function api(
  path,
  options = {}
) {

  if (
    typeof navigator !==
      'undefined' &&
    navigator.onLine === false
  ) {

    throw new ApiError(
      'Internet connection check karein.',
      {
        code:
          'OFFLINE'
      }
    );

  }


  let res;


  try {

    res =
      await fetch(
        API + path,
        {
          credentials:
            'include',

          headers: {
            'Content-Type':
              'application/json',

            ...(options.headers || {})
          },

          ...options
        }
      );

  } catch (error) {

    console.error(
      'API network error:',
      error
    );


    throw new ApiError(
      'Server se connection nahi ho pa raha hai. Internet check karke dobara try karein.',
      {
        code:
          'NETWORK_ERROR'
      }
    );

  }


  let data = {};


  try {

    const text =
      await res.text();


    if (text) {

      try {

        data =
          JSON.parse(text);

      } catch {

        data = {};

      }

    }

  } catch {

    data = {};

  }


  if (!res.ok) {

    let fallbackMessage =
      'Something went wrong. Please try again.';


    if (
      res.status === 400
    ) {

      fallbackMessage =
        'Request sahi nahi hai. Please details check karein.';

    }


    if (
      res.status === 401
    ) {

      fallbackMessage =
        'Session expire ho gaya hai. Please login again.';

    }


    if (
      res.status === 403
    ) {

      fallbackMessage =
        'Aapko is action ki permission nahi hai.';

    }


    if (
      res.status === 404
    ) {

      fallbackMessage =
        'Requested information nahi mili.';

    }


    if (
      res.status === 409
    ) {

      fallbackMessage =
        'Ye request already exist karti hai ya conflict ho raha hai.';

    }


    if (
      res.status === 429
    ) {

      fallbackMessage =
        'Bahut zyada requests ho gayi hain. Thodi der baad dobara try karein.';

    }


    if (
      res.status >= 500
    ) {

      fallbackMessage =
        'Server me temporary problem hai. Please thodi der baad dobara try karein.';

    }


    throw new ApiError(
      data.message ||
      fallbackMessage,
      {
        status:
          res.status,

        code:
          res.status === 401
            ? 'UNAUTHORIZED'
            : 'HTTP_ERROR'
      }
    );

  }


  return data;
}


/* =========================
   MONEY
========================= */

function money(n) {

  return `₹${Number(n || 0)
    .toLocaleString(
      'en-IN',
      {
        maximumFractionDigits:
          2
      }
    )}`;

}


/* =========================
   ESCAPE
========================= */

function esc(s) {

  return String(s ?? '')
    .replace(
      /[&<>'"]/g,
      c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[c])
    );

}


/* =========================
   TOAST
========================= */

function toast(
  msg,
  type = 'message'
) {

  const old =
    document.querySelector(
      '.message'
    );


  if (old) {
    old.remove();
  }


  const el =
    document.createElement(
      'div'
    );


  el.className =
    `message ${type}`;


  el.textContent =
    msg;


  document.body.prepend(
    el
  );


  setTimeout(
    () => {

      el.remove();

    },
    3500
  );

}


/* =========================
   ADD TO CART POPUP
========================= */

function showCartPopup() {

  document
    .querySelector(
      '#cartSuccessPopup'
    )
    ?.remove();


  const overlay =
    document.createElement(
      'div'
    );


  overlay.id =
    'cartSuccessPopup';


  overlay.className =
    'modal show';


  overlay.innerHTML = `

    <div
      class="modalbox"
      style="
        max-width:420px;
        text-align:center;
      "
    >

      <div
        style="
          font-size:52px;
          margin-bottom:10px;
        "
      >
        ✅
      </div>


      <h2
        style="
          margin:0 0 10px;
        "
      >
        Added to Cart
      </h2>


      <p class="muted">

        Product successfully
        cart me add ho gaya hai.

      </p>


      <div
        class="actions"
        style="
          justify-content:center;
          margin-top:20px;
        "
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


  document.body.appendChild(
    overlay
  );


  overlay
    .querySelector(
      '.cart-popup-close'
    )
    ?.addEventListener(
      'click',
      () => {

        overlay.remove();

      }
    );


  overlay.addEventListener(
    'click',
    event => {

      if (
        event.target === overlay
      ) {

        overlay.remove();

      }

    }
  );

}


/* =========================
   CURRENT USER
========================= */

async function currentUser() {

  try {

    const data =
      await api(
        '/auth/me'
      );


    return data.user || null;

  } catch (error) {

    /*
      Normal not-logged-in situation.
    */

    if (
      error?.status === 401 ||
      error?.code ===
        'UNAUTHORIZED'
    ) {

      return null;

    }


    /*
      Navbar ko completely break
      hone se bachane ke liye
      network/server error par
      logged-out UI dikhaya jayega.
    */

    console.error(
      'Current user error:',
      error
    );


    return null;

  }

}


/* =========================
   REQUIRE LOGIN
========================= */

async function requireLogin() {

  try {

    const data =
      await api(
        '/auth/me'
      );


    if (data.user) {

      return data.user;

    }


    location.href =
      BASE +
      '/frontend/login.html?next=' +
      encodeURIComponent(
        location.pathname +
        location.search
      );


    return null;


  } catch (error) {

    /*
      User actually logged out /
      session expired.
    */

    if (
      error?.status === 401 ||
      error?.code ===
        'UNAUTHORIZED'
    ) {

      location.href =
        BASE +
        '/frontend/login.html?next=' +
        encodeURIComponent(
          location.pathname +
          location.search
        );


      return null;

    }


    /*
      IMPORTANT:
      Internet/server error par
      login page par redirect nahi
      karenge.
    */

    console.error(
      'Login check error:',
      error
    );


    toast(
      error?.message ||
      'Account verify nahi ho pa raha hai. Please dobara try karein.',
      'error'
    );


    return null;

  }

}


/* =========================
   LOGOUT
========================= */

async function logoutUser() {

  const button =
    $('#logoutBtn');


  const oldText =
    button?.textContent;


  if (button) {

    button.disabled =
      true;

    button.textContent =
      'Logging out...';

  }


  try {

    await api(
      '/auth/logout',
      {
        method:
          'POST'
      }
    );


    location.href =
      BASE +
      '/frontend/login.html';


  } catch (error) {

    console.error(
      'Logout error:',
      error
    );


    toast(
      error?.message ||
      'Logout nahi ho pa raha hai. Please dobara try karein.',
      'error'
    );


    if (button) {

      button.disabled =
        false;

      button.textContent =
        oldText ||
        'Logout';

    }

  }

}


/* =========================
   NAV
========================= */

async function nav() {

  const el =
    $('#nav');


  if (!el) return;


  const user =
    await currentUser();


  el.innerHTML = `

    <div class="container nav">

      <a
        class="brand"
        href="${BASE}/frontend/index.html"
      >
        MEMORA CREATIONS
      </a>


      <form
        class="search"
        id="globalSearch"
      >

        <input
          class="input"
          placeholder="Search products..."
          name="q"
          autocomplete="off"
        >


        <button
          class="btn"
          type="submit"
        >
          Search
        </button>

      </form>


      <div class="navlinks">

        <a
          href="${BASE}/frontend/index.html"
        >
          Home
        </a>


        <a
          href="${BASE}/frontend/products.html"
        >
          Products
        </a>


        ${
          user
            ? `

              <a
                href="${BASE}/frontend/orders.html"
              >
                Orders
              </a>


              <a
                href="${BASE}/frontend/profile.html"
              >
                Profile
              </a>


              <a
                href="${BASE}/frontend/cart.html"
              >
                Cart
                (
                <span id="cartCount">
                  0
                </span>
                )
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

      </div>

    </div>

  `;


  const searchForm =
    $('#globalSearch');


  if (searchForm) {

    searchForm.addEventListener(
      'submit',
      event => {

        event.preventDefault();


        const q =
          String(
            new FormData(
              event.currentTarget
            )
              .get('q') ||
            ''
          )
            .trim();


        location.href =
          BASE +
          '/frontend/products.html?q=' +
          encodeURIComponent(q);

      }
    );

  }


  const logoutButton =
    $('#logoutBtn');


  if (logoutButton) {

    logoutButton.addEventListener(
      'click',
      logoutUser
    );

  }


  if (user) {

    await updateCartCount();

  }

}


/* =========================
   CART COUNT
========================= */

async function updateCartCount() {

  const el =
    $('#cartCount');


  if (!el) return;


  try {

    const d =
      await api(
        '/cart'
      );


    el.textContent =
      (
        d.cart?.items ||
        []
      )
        .reduce(
          (
            sum,
            item
          ) =>
            sum +
            Number(
              item.quantity ||
              0
            ),
          0
        );


  } catch (error) {

    console.error(
      'Cart count error:',
      error
    );


    el.textContent =
      '0';

  }

}


/* =========================
   BOTTOM NAV
========================= */

async function bottomNav() {

  const el =
    $('#bottomNav');


  if (!el) return;


  const user =
    await currentUser();


  document.body.classList.add(
    'has-bottomnav'
  );


  const path =
    location.pathname
      .toLowerCase();


  const active =
    page =>
      path.includes(page);


  el.innerHTML = `

    <a
      href="${BASE}/frontend/index.html"
      class="${
        active(
          '/frontend/index.html'
        )
          ? 'active'
          : ''
      }"
    >

      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          d="M3 10.5L12 3l9 7.5"
        ></path>

        <path
          d="M5 9.5V20h14V9.5"
        ></path>
      </svg>

      <span>
        Home
      </span>

    </a>


    <a
      href="${BASE}/frontend/products.html"
      class="${
        active(
          '/frontend/products.html'
        )
          ? 'active'
          : ''
      }"
    >

      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >

        <rect
          x="3"
          y="3"
          width="7"
          height="7"
          rx="1"
        ></rect>

        <rect
          x="14"
          y="3"
          width="7"
          height="7"
          rx="1"
        ></rect>

        <rect
          x="3"
          y="14"
          width="7"
          height="7"
          rx="1"
        ></rect>

        <rect
          x="14"
          y="14"
          width="7"
          height="7"
          rx="1"
        ></rect>

      </svg>

      <span>
        Products
      </span>

    </a>


    ${
      user
        ? `

          <a
            href="${BASE}/frontend/cart.html"
            class="${
              active(
                '/frontend/cart.html'
              )
                ? 'active'
                : ''
            }"
          >

            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >

              <circle
                cx="9"
                cy="20"
                r="1"
              ></circle>

              <circle
                cx="18"
                cy="20"
                r="1"
              ></circle>

              <path
                d="M3 4h2l2 11h11l2-8H7"
              ></path>

            </svg>

            <span>
              Cart
            </span>

          </a>


          <a
            href="${BASE}/frontend/orders.html"
            class="${
              active(
                '/frontend/orders.html'
              )
                ? 'active'
                : ''
            }"
          >

            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >

              <path
                d="M8 6h13"
              ></path>

              <path
                d="M8 12h13"
              ></path>

              <path
                d="M8 18h13"
              ></path>

              <path
                d="M3 6h.01"
              ></path>

              <path
                d="M3 12h.01"
              ></path>

              <path
                d="M3 18h.01"
              ></path>

            </svg>

            <span>
              Orders
            </span>

          </a>


          <a
            href="${BASE}/frontend/profile.html"
            class="${
              active(
                '/frontend/profile.html'
              )
                ? 'active'
                : ''
            }"
          >

            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >

              <circle
                cx="12"
                cy="8"
                r="4"
              ></circle>

              <path
                d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"
              ></path>

            </svg>

            <span>
              Profile
            </span>

          </a>

        `
        : `

          <a
            href="${BASE}/frontend/login.html"
            class="${
              active(
                '/frontend/login.html'
              )
                ? 'active'
                : ''
            }"
          >

            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >

              <circle
                cx="12"
                cy="8"
                r="4"
              ></circle>

              <path
                d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"
              ></path>

            </svg>

            <span>
              Login
            </span>

          </a>

        `
    }

  `;

}


/* =========================
   START
========================= */

document.addEventListener(
  'DOMContentLoaded',
  async () => {

    try {

      await Promise.all([
        nav(),
        bottomNav()
      ]);

    } catch (error) {

      console.error(
        'Navigation init error:',
        error
      );

    }

  }
);


/* =========================
   EXPORT
========================= */

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
