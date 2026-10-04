# MEMORA CREATIONS

Full-stack e-commerce application using HTML/CSS/JavaScript, Node.js, Express and MongoDB.

## Important scope

- WhatsApp Order is intentionally disabled and is not part of the application.
- Customer login is **Mobile Number + Password**.
- Orders are only **COD** or **Razorpay Online Payment**.
- Razorpay secret stays on the server in `.env`.
- Passwords are bcrypt-hashed.
- Customer cart/orders/profile are protected by HTTP-only JWT cookies.
- Admin APIs require a separate backend-verified admin role.


## Implemented phases

- **Phase 1:** Architecture and MongoDB/Mongoose models.
- **Phase 2:** Express REST API foundation, controllers, middleware, validation and errors.
- **Phase 3:** Customer/admin authentication, secure password hashing, HTTP-only JWT cookies and password reset flow.
- **Phase 4:** Product/catalog/category/search/filter system.
- **Phase 5:** Persistent database cart, quantity/stock validation and Buy Now flow.
- **Phase 6:** Checkout, server-trusted pricing, COD orders, order success and order history.
- **Phase 7:** Razorpay order creation and server-side HMAC signature verification.
- **Phase 8:** COD payment state and stock reservation/release.
- **Phase 9:** Secure admin panel, product/category/image/stock/order/customer management and dashboard.
- **Phase 10:** Intentionally disabled/removed. WhatsApp Order is not implemented.
- **Phase 11:** Frontend pages connected to backend APIs and responsive mobile/desktop UI.
- **Phase 12:** Static/syntax/asset consistency checks and automated API test suite prepared. Full runtime payment/database testing requires external credentials/services.

## Audit status

A source-level audit was performed after the initial build. Missing order-details wiring, Buy Now cart-clearing behavior, payment amount/capture verification, failed-payment retry state, homepage catalog sections, unique product IDs, category duplication handling, and admin cancellation/stock rules were corrected. WhatsApp ordering remains disabled.

## Runtime verification limitation

The source was syntax-checked successfully and all local HTML asset references were checked. `npm install` could not complete in the build environment because the package download operation timed out, so the automated Node/Supertest suite could not be executed here. Do not treat that as a successful runtime test. After installing dependencies locally, run `npm test` and then perform the live MongoDB + Razorpay Test Mode checkout flow before production deployment.

## Order/payment rules

- WhatsApp ordering is disabled.
- Customer login uses Mobile Number + Password.
- Order payment methods are only COD and Razorpay.
- Frontend prices are never trusted when an order is created; backend reads current product prices from MongoDB.
- Online payment stock is reserved before the Razorpay checkout and released if the payment fails/cancels. Successful server verification marks the payment successful and clears the cart.
- Customer tracking is based on order status history. Admin status changes are persisted to MongoDB.

## Requirements

- Node.js 20+
- MongoDB Atlas or MongoDB server
- Razorpay account for online payments
- Cloudinary account for product images
- SMTP account for password reset email (optional during local development, required for actual email delivery)

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

## Razorpay

Put the Test Mode credentials in:

```env
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

The Key ID is returned by the backend to the browser for Checkout. The Key Secret is never returned to the browser.

For production, replace test credentials with live credentials and deploy behind HTTPS.

## Cloudinary

```env
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

The browser receives a short-lived signed upload payload from the protected admin API; the Cloudinary API secret remains server-side.

## Email reset

Configure:

```env
SMTP_HOST=...
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASSWORD=...
MAIL_FROM="MEMORA CREATIONS <no-reply@example.com>"
```

## Production deployment

1. Create a production MongoDB database.
2. Create Razorpay Live API keys.
3. Create Cloudinary production credentials.
4. Configure SMTP.
5. Set `NODE_ENV=production`.
6. Set `CLIENT_URL` and `CORS_ORIGIN` to the real HTTPS domain.
7. Set a long random `JWT_SECRET` (32+ characters).
8. Run `npm install --omit=dev`.
9. Run `npm run seed:admin` once.
10. Start with `npm start` or a process manager such as PM2.
11. Put the application behind HTTPS/reverse proxy.
12. Configure the Razorpay webhook URL to `/api/payment/webhook` if webhook handling is enabled in your merchant account.

## Tests

```bash
npm test
```

The included automated tests cover API health, API 404 handling and anonymous cart protection. Full payment testing requires real Razorpay Test Mode credentials and a reachable MongoDB instance.
