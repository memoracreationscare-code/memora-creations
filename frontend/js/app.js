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


  /* SEARCH */

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


  /* LOGOUT */

  const logoutButton =
    $('#logoutBtn');


  if (logoutButton) {

    logoutButton.addEventListener(
      'click',
      logoutUser
    );

  }


  /* CART COUNT */

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


  el.innerHTML = `

    <a
      href="${BASE}/frontend/index.html"
    >
      HOME
    </a>


    <a
      href="${BASE}/frontend/products.html"
    >
      PRODUCTS
    </a>


    ${
      user
        ? `

          <a
            href="${BASE}/frontend/cart.html"
          >
            CART
          </a>


          <a
            href="${BASE}/frontend/orders.html"
          >
            ORDERS
          </a>


          <a
            href="${BASE}/frontend/profile.html"
          >
            PROFILE
          </a>

        `
        : `

          <a
            href="${BASE}/frontend/login.html"
          >
            LOGIN
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
