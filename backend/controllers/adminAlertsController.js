'use strict';

/*
  GET /api/admin/pending-counts

  Small numbers for the admin panel badges and the "needs your
  attention" banner. Read-only.
*/

const { Order } = require('../models');
const { asyncHandler, ok } = require('../utils/http');

const pendingCounts = asyncHandler(async (_req, res) => {
  const [cancellations, returns] = await Promise.all([
    Order.countDocuments({
      orderStatus: { $ne: 'Cancelled' },
      statusHistory: {
        $elemMatch: { note: { $regex: '^CUSTOMER_CASHFREE_CANCEL_REQUEST' } }
      }
    }),
    Order.countDocuments({ 'returnRequest.status': 'REQUESTED' })
  ]);

  return ok(res, { cancellations, returns });
});

module.exports = { pendingCounts };
