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

## Automatic delivery status

`backend/services/shipmentSync.js` runs every 30 minutes on the server. For orders whose shipment was created from the admin panel (so it has an AWB), it asks Shiprocket for the tracking status and moves the order forward: Shipped, Out for Delivery, Delivered. The new status shows in the admin panel and in the customer's order page. Orders only move forward; cancelled, returned (RTO), lost or damaged shipments are left for the owner. Payments, stock and coupons are not touched. Set `SHIPMENT_AUTO_SYNC=false` to turn it off. Shipments made directly in the Shiprocket website are not linked to orders and are not synced.

## Return parcels (admin)

`admin/return-parcels.html` (API `GET /api/admin/return-parcels`) lists shipments that did not reach the customer: Undelivered, returning (RTO), returned, lost or damaged. It reads the Shiprocket status already saved by the tracking sync, offers a WhatsApp "Contact customer" button with a ready message and a local "Mark as handled" check. It is read-only and sends nothing. The status rules are in `backend/utils/returnParcels.js` with tests in `tests/return-parcels.test.js`.

## Small extras added later

- Customer order page: **Download Invoice** button (`frontend/js/invoice.js`), a printable bill built in the browser. It is an order bill, not a GST tax invoice.
- Product page: **Share on WhatsApp** button.
- Admin Orders: **Export CSV** (`admin/js/orders-export.js`) for accounts; exports the orders that match the search box.
- Admin Products: search box (`admin/js/products-search.js`).

## COD remittance (admin)

`admin/cod-remittance.html` (API `GET /api/admin/cod-remittance`) shows where the money of each Cash-on-Delivery order is: with the courier, delivered and awaited, received, or not collected, plus the live Shiprocket wallet balance. The amounts are order totals (Shiprocket deducts its charges before paying out). The page does not read Shiprocket's own remittance list because no documented API for it was found; the real payouts are under Billing > COD Remittance in Shiprocket. "Mark as received" uses the existing COD-paid route and only updates the owner's record. Rules are in `backend/utils/codRemittance.js` with tests in `tests/cod-remittance.test.js`.

## COD with advance payment (off by default)

When `COD_ADVANCE_ENABLED=true` in Render, a customer who chooses Cash on Delivery first pays `COD_ADVANCE_PERCENT` (default 30, allowed 5 to 90) of the total online through Cashfree and pays the rest to the courier. Without that variable nothing changes.

- Such an order is stored as a normal Cashfree order whose gateway amount is only the advance, plus a `codAdvance` block on the order (`advanceAmount`, `balanceAmount`, `balanceStatus`). Rules and the exact-to-the-paisa split are in `backend/utils/codAdvance.js` with tests in `tests/cod-advance.test.js`.
- Payment verification, the webhook and the cleanup service compare against the advance (`onlineAmount`) instead of the full total.
- Shiprocket receives the order as COD and collects only the balance (`codFigures` in `backend/services/shiprocketService.js`). For every COD order the discount sent to Shiprocket is now worked out so the courier collects exactly what the customer owes.
- The admin Orders label shows the cash to collect, the COD Remittance page uses the balance, and "Mark as received" on that page records the balance.
- Refunds of the advance are done by hand in the Cashfree dashboard. The automatic cancellation/refund pages compare against the full total, so they refuse advance orders instead of refunding the wrong amount.
- The checkout reads `GET /api/health` (`codAdvance.enabled`, `codAdvance.percent`) to decide whether to show the advance notice.

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

## Return / Replacement requests

After an order is **Delivered**, the customer sees a "Return / Replacement"
button in My Orders (default window: 7 days from delivery, change with
`RETURN_WINDOW_DAYS` in Render). The request appears in **Admin → Return
Requests** with Approve / Reject / Completed buttons and a WhatsApp link.
A request never refunds money or changes the order status by itself:
refund online orders from the Cashfree dashboard.

## Online payment details in admin

For Cashfree orders the admin order view shows the payment method, payer UPI ID,
UTR / bank reference, bank, card last 4 digits, amount and time. They are saved
automatically when the payment is confirmed (webhook or verification). For older
paid orders press **Refresh payment details** in the order view.

## Admin request alerts

On every admin page, a red banner and red numbers on the menu links show how many
customer **return/replacement** and **cancellation** requests are waiting for you
(also shown in the browser tab title, e.g. `(3) Orders`). It refreshes every minute
and disappears when nothing is pending.

## Automatic cancellation, refund and cleanup

- **Customer cancels** an order that is not shipped yet (Order Placed / Confirmed):
  the order is cancelled at once, stock and coupon are given back, and a booked
  Shiprocket order is cancelled too.
- **Paid online orders** are refunded through Cashfree automatically when you set
  `AUTO_REFUND_ENABLED=true` in Render (off by default). Without it the customer
  sends a request and you handle it as before.
- If the refund or the Shiprocket cancel fails, the order is still cancelled and a
  red box appears on the **Cancellation Requests** page (and in the admin banner)
  with what to finish by hand. Press **Done** afterwards.
- **Unpaid online orders** are cancelled automatically 40 minutes after they were
  placed (stock returns); if Cashfree says it was actually paid, the order is marked
  paid. Turn off with `PENDING_PAYMENT_AUTO_CANCEL=false`.

## More automatic things

- **COD money:** Shiprocket pays you a few days after delivery and has no API to read it.
  Set `COD_AUTO_RECEIVE_DAYS` (for example `8`) in Render and delivered COD orders are marked
  "payment received" by themselves after that many days. Compare with Shiprocket -> Billing ->
  COD Remittance. Empty or 0 = off.
- **Low stock alert:** the admin banner shows how many products have 3 or fewer left.
- **Website:** "You may also like" on every product page and "Only N left" when stock is 5 or less.
- **Add product errors:** the admin product form now says exactly which field is wrong and keeps the message on screen.

## Cashfree refunds read back automatically

Every 15 minutes the server reads refunds from Cashfree for paid orders (last 60 days).
A refund you make by hand in the Cashfree dashboard shows as "Refund processing" /
"Refunded" in the admin and on the customer's order. If the whole payment was refunded and the
order was not shipped, the order is cancelled, stock/coupon return and a booked Shiprocket order
is cancelled. Switch off with `REFUND_SYNC=false`.

## Admin: Online Payments page

**Admin → Online Payments** lists every online payment with method, UPI ID, UTR, bank,
Cashfree IDs and refund status (refreshes every 30 seconds, searchable by order, UPI ID or UTR).
- **Verify** asks Cashfree if the payment is really PAID for the right amount and saves the details.
- **Refund** sends a full or part refund through Cashfree (you confirm twice). A full refund of an
  order that is not shipped also cancels it (stock, coupon, Shiprocket). The refund then shows
  as "Refund processing / Refunded" on the website and in the admin.

## Admin: Store Settings (control the website from the admin)

**Admin → Store Settings** changes, without touching code or Render:
store open/closed (pause orders), WhatsApp / phone / email / address / social links,
delivery charge and free-delivery limit, Cash on Delivery on/off, COD advance and percent,
return days and on/off, automatic refund and COD auto-receive days, and the homepage first-screen text.
Saved values win over Render values; the website picks them up within about a minute.
Other things already controlled from the admin: products, categories, coupons, announcement popup,
orders, payments and refunds, reviews, customers, return requests.

## Homepage banner slider (Admin → Banners)

Add banners with a photo, optional heading, sub-text, button and link, set the order and an optional
start/end date. Active banners slide on the homepage (auto, arrows, dots, swipe on mobile).
With no banners the homepage looks as before.

## Customer emails (order updates + abandoned cart reminder)

Switch them on in **Admin → Store Settings → Messages to customers**. Needs a free email service:

**Brevo (recommended, free 300 emails a day, no domain needed)**
1. Sign up at brevo.com, then *SMTP & API → API keys → Generate a new API key*.
2. In Brevo, *Senders, Domains → Senders → Add a sender* with your Gmail address and click the link they email you.
3. In Render → Environment add `BREVO_API_KEY` (the key), `MAIL_FROM_EMAIL` (that Gmail address) and, if you like, `MAIL_FROM_NAME` = `Memora Creations`.

The server then sends: order placed, shipped, out for delivery, delivered, cancelled, refunded, and one
reminder for a cart left for 24 hours (change in settings). Each email goes once, only for orders and carts that
appear after you switched the option on, and never for checkouts that were never paid.
WhatsApp messages need Meta business approval and paid templates, so email is the automatic channel; the
Abandoned Carts page still has the one-tap WhatsApp button.

## First-order discount and Refer & Earn (Admin → Store Settings)

- **First-order discount:** switch on, choose percent, maximum and minimum order. The code **WELCOME** is created for you and works only on a customer's first order. It shows on the customer's Profile page.
- **Refer & Earn:** every customer has a code and a WhatsApp share button on the Profile page. The friend gets a one-time coupon when they sign up with it; the referrer gets one when the friend's first order is **delivered**. Coupons are personal (only that customer), single use and expire in 60 days.

## Product options (size / colour)

In Admin → Products, use **"+ Option jodo"** to add options (e.g. "Large / Red") with their own stock and, optionally, their own price/MRP. Products without options work exactly as before. With options, the product's stock is the total of its options; customers must pick an option on the product page, and stock is reduced/restored per option on orders and cancellations.

## Admin 2-step login

Admin → Store Settings → "Admin security" turns on 2-step login (Google / Microsoft Authenticator). After the password the login asks for the 6 digit code. Eight one-time recovery codes are shown once when it is switched on. If the phone AND the recovery codes are lost, set `ADMIN_2FA_DISABLE=true` in Render, log in with the password only, turn 2-step off and on again, then remove the variable.

## Sitemap

`.github/workflows/update-sitemap.yml` rebuilds `sitemap.xml` (all live products) every day and can be run by hand from the GitHub Actions tab ("Update sitemap" → Run workflow).
