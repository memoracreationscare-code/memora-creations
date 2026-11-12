'use strict';

/*
  GET /api/admin/orders/:id/invoice   (admin: any order)
  GET /api/orders/:id/invoice         (customer: only their own order)
*/

const mongoose = require('mongoose');
const { asyncHandler, error, ok } = require('../utils/http');

async function respond(req, res, ownerOnly) {
  if (!mongoose.isValidObjectId(req.params.id)) throw error(400, 'Invalid order ID.');

  const models = require('../models');
  const filter = { _id: req.params.id };

  if (ownerOnly) filter.user = req.user._id;

  const order = await models.Order.findOne(filter).lean();

  if (!order) throw error(404, 'Order not found.');

  const settings = await require('../services/settingsService').load();
  const invoice = await require('../services/invoiceService').invoiceFor(
    order,
    { Order: models.Order, SiteSettings: require('../models/SiteSettings') },
    settings
  );

  res.set('Cache-Control', 'private, no-store');

  return ok(res, { invoice });
}

const adminInvoice = asyncHandler((req, res) => respond(req, res, false));
const customerInvoice = asyncHandler((req, res) => respond(req, res, true));

module.exports = { adminInvoice, customerInvoice };
