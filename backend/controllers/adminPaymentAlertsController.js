'use strict';

const { asyncHandler, ok } = require('../utils/http');
const watch = require('../services/paymentWatch');

/* GET /api/admin/payment-alerts   (owner only) */
const list = asyncHandler(async (_req, res) => ok(res, await watch.scan()));

module.exports = { list };
