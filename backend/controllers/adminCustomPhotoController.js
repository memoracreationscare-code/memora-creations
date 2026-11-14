'use strict';

const { Order } = require('../models');
const { asyncHandler, error, ok } = require('../utils/http');
const photos = require('../services/customPhotoService');

/* DELETE /api/admin/orders/:id/custom-photos : delete this order's photos now. */
const deleteNow = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) throw error(404, 'Order not found.');

  if (!photos.photoIdsOfOrder(order).length) throw error(400, 'Is order me koi customer photo nahi hai.');

  if (order.customPhotosDeletedAt) throw error(409, 'Photos pehle hi delete ho chuki hain.');

  const deleted = await photos.deleteOrderPhotos(order);

  return ok(res, { message: `${deleted} photo delete ho gayi.`, deleted });
});

module.exports = { deleteNow };
