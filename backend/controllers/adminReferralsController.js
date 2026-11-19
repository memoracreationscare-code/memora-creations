'use strict';

/*
  GET  /api/admin/referrals?search=   referral history, totals, top referrers
  POST /api/admin/referrals/run       run the reward check now (it also runs by itself)
  Read-only apart from the reward check, which is safe to repeat.
*/

const referral = require('../services/referralService');
const { asyncHandler, ok } = require('../utils/http');

const list = asyncHandler(async (req, res) => {
  const data = await referral.adminOverview({ search: req.query.search, limit: req.query.limit });

  return ok(res, { ...data, enabled: require('../services/settingsService').peek().referralEnabled === true });
});

const run = asyncHandler(async (_req, res) => {
  const result = await referral.rewardReferrers();

  return ok(res, { rewarded: result.rewarded });
});

module.exports = { list, run };
