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
   API
========================= */

async function api(
  path,
  options = {}
) {

  const res =
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


  let data = {};


  try {

    data =
      await res.json();

  } catch {}


  if (!res.ok) {

    throw new Error(
      data.message ||
      'Request failed.'
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

  } catch {

    return null;

  }

}


/* =========================
   REQUIRE LOGIN
========================= */

async function requireLogin() {

  const user =
    await currentUser();


  if (!user) {

    location.href =
      BASE +
      '/frontend/login.html?next=' +
      encodeURIComponent(
        location.pathname +
        location.search
      );


    return null;

  }


  return user;
}


/* =========================
   LOGOUT
========================= */

async function logoutUser() {

  try {

    await api(
      '/auth/logout',
      {
        method:
          'POST'
      }
    );

  } catch {}


  location.href =
    BASE +
    '/frontend/login.html';

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


  } catch {

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

    await Promise.all([
      nav(),
      bottomNav()
    ]);

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

  logoutUser

};
