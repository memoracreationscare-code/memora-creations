# MEMORA CREATIONS

Full-stack e-commerce application using HTML/CSS/JavaScript, Node.js, Express and MongoDB.

## Important scope

- WhatsApp **ordering** is intentionally disabled and is not part of the application. WhatsApp is only used as a customer-support link and, when enabled, for order status notifications through the WhatsApp Cloud API.
- Customer login is **Mobile Number + Password**.
- Orders are only **COD** or **Cashfree Online Payment** (the checkout page uses Cashfree).
- Payment secrets stay on the server in `.env`.
- Passwords are bcrypt-hashed.
- Customer cart/orders/profile are protected by HTTP-only JWT cookies.
- Admin APIs require a separate backend-verified admin role.

## Current deployment

| Part | Where | Notes |
| --- | --- | --- |
| Website (main) | GitHub Pages: `https://memoracreationscare-code.github.io/memora-creations/frontend/index.html` | Canonical address used in SEO tags |
| Website (mirror) | Cloudflare Pages: `https://memora-creations.pages.dev/` | Deployed by `.github/workflows/deploy-cloudflare.yml` on every push to `main` |
| Backend API | Render: `https://memora-creations.onrender.com` | Node/Express + MongoDB |

Things worth knowing:

- Responses are gzip-compressed by the `compression` middleware in `backend/server.js` (optional: the server still starts if the package is missing). `admin/js/auth.js` makes simultaneous identical requests for `/admin/dashboard` and `/admin/orders` share one call, so admin pages do not ask the server for the same data twice.
- The frontend finds the backend through the `API` constant at the top of `frontend/js/app.js`. Change it there if the backend moves.
- The Cloudflare workflow rewrites `/memora-creations/` paths to `/` for the mirror and needs the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. `github.io` URLs (canonical and Open Graph tags) are intentionally left untouched.
- The frontend and the API live on different domains, so in production the auth cookie is `SameSite=None; Secure` unless `COOKIE_SAMESITE` is set. `backend/server.js` always allows the `github.io` and `pages.dev` origins in CORS, plus anything listed in `CORS_ORIGIN`.
- `.github/workflows/keep-render-awake.yml` pings `/api/health` every 10 minutes so a free Render instance does not fall asleep. Scheduled workflows pause after 60 days without repository activity; re-enable it from the Actions tab if that happens. The homepage also shows a "server is starting" message when the backend takes longer than 6 seconds. The admin pages show the same kind of message.

## Loader

A logo loader (cream screen, round logo, turning gold ring) is added to every customer page: `frontend/css/loader.css`, `frontend/js/loader.js` and a `#mcLoader` block right after `<body>`. It shows for at least 1 second on the first page of a visit; on later pages it only appears if loading takes more than half a second. It never stays longer than 8 seconds.

## Extras

- `frontend/js/extras.js` (every customer page): floating WhatsApp chat button and a back-to-top button.
- Homepage FAQ section (`#faq` in `frontend/index.html`).
- `404.html` at the repository root is the branded "page not found" page on GitHub Pages.

## Animations

`frontend/js/animations.js` (every customer page): hero entrance, floating decor, scroll fade-in for cards and sections, shine on the main button. Disabled automatically when the device asks for reduced motion.

## SEO

- Public pages (home, products, about, contact, policies) have a canonical URL, Open Graph and Twitter tags. The sharing image is `frontend/images/og-image.png`, built from the brand logo. The logo files live in `frontend/images/` (`logo.png` for the header, `favicon-48.png`, `favicon-192.png` and `apple-touch-icon.png` for browser/phone icons). The header logo is added in `frontend/js/app.js` and styled at the end of `frontend/css/premium-navbar.css`.
- Private pages (cart, checkout, login, orders, profile, wishlist, password reset) and every admin page carry `noindex, nofollow`.
- `sitemap.xml` at the repository root lists the public pages. Submit `https://memoracreationscare-code.github.io/memora-creations/sitemap.xml` in Google Search Console. Add new public pages to it by hand.

## Implemented phases

- **Phase 1:** Architecture and MongoDB/Mongoose models.
- **Phase 2:** Express REST API foundation, controllers, middleware, validation and errors.
- **Phase 3:** Customer/admin authentication, secure password hashing, HTTP-only JWT cookies and password reset flow.
- **Phase 4:** Product/catalog/category/search/filter system.
- **Phase 5:** Persistent database cart, quantity/stock validation and Buy Now flow.
- **Phase 6:** Checkout, server-trusted pricing, COD orders, order success and order history.
- **Phase 7:** Online payment order creation and server-side signature verification (first built on Razorpay, now Cashfree for checkout, see below).
- **Phase 8:** COD payment state and stock reservation/release.
- **Phase 9:** Secure admin panel, product/category/image/stock/order/customer management and dashboard.
- **Phase 10:** Intentionally disabled/removed. WhatsApp Order is not implemented.
- **Phase 11:** Frontend pages connected to backend APIs and responsive mobile/desktop UI.
- **Phase 12:** Static/syntax/asset consistency checks and automated API test suite prepared. Full runtime payment/database testing requires external credentials/services.

### Later additions (present in the code)

- Cashfree online payments with webhook (`/api/cashfree/webhook`), plus admin refund verification (read-only) and a sandbox-only refund initiation page.
- Coupons (customer and admin), product reviews, wishlist and an admin announcement popup.
- Delivery pincode check and delivery estimate, Shiprocket shipment tracking.
- Gift wrapping (disabled unless `GIFT_WRAPPING_LIVE_ENABLED=true`).
- Optional WhatsApp order-status notifications (disabled unless `WHATSAPP_SEND_ENABLED=true`).
- Admin page **Abandoned Carts** (`admin/abandoned-carts.html`, API `GET /api/admin/abandoned-carts`): lists customers who left products in their cart and did not order, with a one-click "Send WhatsApp" button that opens a chat with a ready message and the cart link. It is read-only and sends nothing from the server, so it is free and cannot get the WhatsApp number banned. The cart rules live in `backend/utils/abandonedCarts.js` and are covered by `tests/abandoned-carts.test.js`.
- Password reset goes through support: the customer asks on the forgot-password page (the request is saved), then the owner sets a new password from the **Customers** page in the admin panel. The Resend email code in `backend/services/emailService.js` exists but nothing calls it yet.

## Audit status (initial build)

A source-level audit was performed after the initial build. Missing order-details wiring, Buy Now cart-clearing behavior, payment amount/capture verification, failed-payment retry state, homepage catalog sections, unique product IDs, category duplication handling, and admin cancellation/stock rules were corrected. WhatsApp ordering remains disabled.

## Runtime verification limitation (initial build)

The source was syntax-checked successfully and all local HTML asset references were checked. `npm install` could not complete in the original build environment because the package download operation timed out, so the automated Node/Supertest suite could not be executed there. Do not treat that as a successful runtime test. After installing dependencies locally, run `npm test` and then perform the live MongoDB + payment sandbox checkout flow before relying on a new deployment.

## Order/payment rules

- WhatsApp ordering is disabled.
- Customer login uses Mobile Number + Password.
- Order payment methods are only COD and Cashfree.
- Frontend prices are never trusted when an order is created; backend reads current product prices from MongoDB.
- Online payment stock is reserved before the payment page opens and released if the payment fails/cancels. Successful server verification marks the payment successful and clears the cart.
- Customer tracking is based on order status history. Admin status changes are persisted to MongoDB.

## Requirements

- Node.js 20+
- MongoDB Atlas or MongoDB server
- Cashfree account for online payments
- Cloudinary account for product images
- Resend account (optional, currently unused: password reset is handled by support, see above)
- Optional: Shiprocket account, WhatsApp Cloud API access

## Setup

```bash
npm install
cp .env.example .env
```

Fill `.env` with real credentials. Never commit `.env`.

Then create/update the admin:

```bash
npm run seed:admin
```

Start:

```bash
npm run dev
```

Open `http://localhost:5000/frontend/index.html`.
Admin: `http://localhost:5000/admin/index.html`.

Note: the frontend calls the API address set in `frontend/js/app.js`, which points to the Render backend. To test against a local backend, temporarily change that constant.

## Cashfree

```env
CASHFREE_ENV=sandbox
CASHFREE_CLIENT_ID=...
CASHFREE_CLIENT_SECRET=...
```

- `CASHFREE_ENV` is `sandbox` (default) or `production`.
- Set the Cashfree webhook URL to `<backend>/api/cashfree/webhook`.
- Refund initiation only works when `CASHFREE_ENV=sandbox` and `CASHFREE_SANDBOX_REFUNDS_ENABLED=true`. Refund verification is read-only.
- The client secret is never returned to the browser.

## Razorpay (legacy)

The backend still contains the earlier Razorpay endpoints (`/api/payment`), but the checkout page does not use them. They only work if these are set:

```env
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

## Cloudinary

```env
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

The browser receives a short-lived signed upload payload from the protected admin API; the Cloudinary API secret remains server-side.

## Email (Resend, currently unused)

```env
RESEND_API_KEY=...
MAIL_FROM="MEMORA CREATIONS <no-reply@your-verified-domain.com>"
```

`MAIL_FROM` must be a sender your Resend account is allowed to use. These values are only needed if email sending is wired in later; the shop works without them.

## Optional integrations

```env
# Shiprocket
SHIPROCKET_EMAIL=...
SHIPROCKET_PASSWORD=...
SHIPROCKET_PICKUP_LOCATION=...

# WhatsApp Cloud API notifications (off unless true)
WHATSAPP_SEND_ENABLED=false
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_API_VERSION=...
WHATSAPP_TEMPLATE_LANGUAGE=...
WHATSAPP_TEMPLATE_ORDER_PLACED=...
WHATSAPP_TEMPLATE_SHIPPED=...
WHATSAPP_TEMPLATE_DELIVERED=...

# Gift wrapping (off unless true)
GIFT_WRAPPING_LIVE_ENABLED=false
```

## Production deployment

1. Create a production MongoDB database.
2. Create Cashfree production credentials and set `CASHFREE_ENV=production`.
3. Create Cloudinary production credentials.
4. Resend is optional (not used by the current password-reset flow).
5. Set `NODE_ENV=production`.
6. Set `CORS_ORIGIN` to the real HTTPS website address (the `github.io` and `pages.dev` addresses are always allowed). `CLIENT_URL` is only used by the unused email code.
7. Set a long random `JWT_SECRET` (32+ characters).
8. Run `npm install --omit=dev`.
9. Run `npm run seed:admin` once.
10. Start with `npm start` or a process manager such as PM2 (on Render, `npm start` is the start command).
11. Put the application behind HTTPS/reverse proxy.
12. Configure the Cashfree webhook URL to `/api/cashfree/webhook`.

## Tests

```bash
npm test
```

The included automated tests cover API health, API 404 handling and anonymous cart protection. Full payment testing requires Cashfree sandbox credentials and a reachable MongoDB instance.
