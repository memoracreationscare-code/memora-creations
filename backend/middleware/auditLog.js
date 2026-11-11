'use strict';

/*
  Writes an activity-log line for every successful change (POST / PUT /
  PATCH / DELETE) made through /api/admin. Request bodies are never stored
  (they can hold passwords or keys): only who, what, which record, when.
*/

// [method, path pattern, label] - first match wins.
const LABELS = [
  ['POST', /^\/orders\/[^/]+\/cashfree\/refunds\/initiate$/, 'Refund shuru kiya (order)'],
  ['POST', /^\/payments\/[^/]+\/refund$/, 'Online payment refund kiya'],
  ['POST', /^\/payments\/[^/]+\/verify$/, 'Payment verify kiya'],
  ['POST', /^\/orders\/[^/]+\/cashfree\/approve$/, 'Cashfree refund approve kiya'],
  ['POST', /^\/orders\/[^/]+\/cod\/paid$/, 'COD paisa mila mark kiya'],
  ['POST', /^\/orders\/[^/]+\/create-shipment$/, 'Shiprocket shipment banayi'],
  ['POST', /^\/orders\/[^/]+\/shipment-dry-run$/, 'Shipment dry run chalaya'],
  ['POST', /^\/orders\/[^/]+\/refresh-payment$/, 'Payment details refresh kiye'],
  ['PUT', /^\/orders\/[^/]+\/note$/, 'Order par note likha'],
  ['PUT', /^\/orders\/[^/]+$/, 'Order status / details badle'],
  ['POST', /^\/2fa\/enable$/, '2-step login chalu kiya'],
  ['POST', /^\/2fa\/disable$/, '2-step login band kiya'],
  ['POST', /^\/products$/, 'Naya product jodaa'],
  ['PUT', /^\/products\/[^/]+$/, 'Product badla'],
  ['DELETE', /^\/products\/[^/]+$/, 'Product hataya'],
  ['POST', /^\/categories$/, 'Category jodi'],
  ['PUT', /^\/categories\/[^/]+$/, 'Category badli'],
  ['DELETE', /^\/categories\/[^/]+$/, 'Category hatayi'],
  ['POST', /^\/banners$/, 'Banner jodaa'],
  ['PUT', /^\/banners\/[^/]+$/, 'Banner badla'],
  ['DELETE', /^\/banners\/[^/]+$/, 'Banner hataya'],
  ['PUT', /^\/settings$/, 'Store Settings badli'],
  ['POST', /^\/test-orders\/delete$/, 'Test orders hataye (cleanup)'],
  ['PATCH', /^\/return-requests\/[^/]+$/, 'Return request par faisla liya'],
  ['POST', /^\/cancel-followups\/[^/]+\/done$/, 'Cancel follow-up done kiya'],
  ['POST', /^\/users\/[^/]+\/toggle$/, 'Customer block / unblock kiya'],
  ['PUT', /^\/users\/[^/]+\/password$/, 'Customer ka password badla'],
  ['POST', /^\/coupons/, 'Coupon jodaa / badla'],
  ['PUT', /^\/coupons/, 'Coupon badla'],
  ['PATCH', /^\/coupons/, 'Coupon badla'],
  ['DELETE', /^\/coupons/, 'Coupon hataya']
];

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function describe(method, path) {
  const hit = LABELS.find(([m, re]) => m === method && re.test(path));
  const parts = String(path || '').split('/').filter(Boolean);
  const id = parts.find(p => /^[a-f0-9]{24}$/i.test(p)) || '';

  return {
    action: hit ? hit[2] : `${method} ${path}`.slice(0, 120),
    targetId: id
  };
}

function auditLog(req, res, next) {
  if (!MUTATING.has(req.method)) return next();

  res.on('finish', () => {
    if (res.statusCode >= 400) return;

    try {
      const { ActivityLog } = require('../models');
      const path = (req.originalUrl || '').split('?')[0].replace(/^\/api\/admin/, '');
      const { action, targetId } = describe(req.method, path);

      ActivityLog.create({
        admin: req.admin?.email || req.admin?.username || req.admin?.name || 'admin',
        action,
        method: req.method,
        path: path.slice(0, 200),
        targetId,
        ip: req.ip
      }).catch(() => {});
    } catch (_) {
      // logging must never break the request
    }
  });

  next();
}

module.exports = { auditLog, describe };
