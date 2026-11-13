'use strict';

/*
  Staff accounts (helpers) can only do the daily packing work:
  see and update orders, add a note, pick the courier and ship, print
  labels / invoices, and handle return requests and parcels.

  They can NOT see sales numbers, customers, payments, refunds, settings,
  coupons, reports, backups or other staff, and cannot change products.
  The owner ("admin") can do everything. Anything not listed here is
  blocked for staff by default.
*/

const ALLOWED = [
  // (chat-test is owner-only: not listed here)
  ['GET',   /^\/me$/],
  ['GET',   /^\/dashboard$/],                        // answered with an empty one, see below
  ['GET',   /^\/today$/],
  ['GET',   /^\/pending-counts$/],
  ['GET',   /^\/orders$/],
  ['GET',   /^\/orders\/[a-f0-9]{24}$/i],
  ['PUT',   /^\/orders\/[a-f0-9]{24}$/i],
  ['POST',  /^\/orders\/[a-f0-9]{24}\/(note|check-couriers|create-shipment|shipment-dry-run)$/i],
  ['PUT',   /^\/orders\/[a-f0-9]{24}\/note$/i],
  ['PATCH', /^\/orders\/[a-f0-9]{24}\/note$/i],
  ['GET',   /^\/orders\/[a-f0-9]{24}\/(shipment-status|invoice|risk)$/i],
  ['GET',   /^\/return-requests(\/[a-f0-9]{24})?$/i],
  ['PATCH', /^\/return-requests\/[a-f0-9]{24}$/i],
  ['PUT',   /^\/return-requests\/[a-f0-9]{24}$/i],
  ['POST',  /^\/return-requests\/[a-f0-9]{24}$/i],
  ['GET',   /^\/return-parcels$/],
  ['PATCH', /^\/return-parcels(\/[a-f0-9]{24})?(\/.*)?$/i],
  ['POST',  /^\/return-parcels(\/[a-f0-9]{24})?(\/.*)?$/i],
  ['POST',  /^\/logout$/]
];

function staffGuard(req, res, next) {
  const admin = req.admin;

  if (!admin || admin.role !== 'staff') return next();

  const path = req.path;
  const method = req.method.toUpperCase();

  // The login check on every admin page asks for the dashboard; staff get an empty one.
  if (method === 'GET' && path === '/dashboard') {
    return res.json({ success: true, dashboard: {}, staff: true });
  }

  if (ALLOWED.some(([m, re]) => m === method && re.test(path))) return next();

  return res.status(403).json({
    success: false,
    message: 'Ye option sirf owner ke liye hai.'
  });
}

module.exports = { staffGuard, ALLOWED };
