'use strict';

const { ActivityLog } = require('../models');
const { asyncHandler, ok } = require('../utils/http');

// GET /api/admin/activity?limit=100
const list = asyncHandler(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 300);
  const rows = await ActivityLog.find().sort({ at: -1 }).limit(limit).lean();

  return ok(res, { activity: rows });
});

module.exports = { list };
