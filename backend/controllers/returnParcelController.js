'use strict';

/*
=========================================
 MEMORA CREATIONS
 ADMIN: RETURN PARCELS

 Read-only. Lists shipments that did not
 reach the customer (undelivered, on the
 way back, returned, lost) using the status
 already saved from Shiprocket tracking.
=========================================
*/

const { ShipmentTracking } = require('../models');
const { asyncHandler, ok } = require('../utils/http');

const {
  PROBLEM_REGEX,
  KINDS,
  classifyParcelStatus
} = require('../utils/returnParcels');

const MAX_PARCELS = 200;

function addressText(address = {}) {
  return [
    address.addressLine,
    address.city,
    address.state,
    address.pinCode
  ].filter(Boolean).join(', ');
}

const listReturnParcels = asyncHandler(async (_req, res) => {
  const shipments = await ShipmentTracking.find({
    shipmentStatus: { $regex: PROBLEM_REGEX }
  })
    .sort({ lastTrackedAt: -1, updatedAt: -1 })
    .limit(MAX_PARCELS)
    .populate(
      'order',
      'orderId shippingAddress grandTotal paymentMethod paymentStatus orderStatus'
    )
    .lean();

  const parcels = shipments
    .map(shipment => {
      const kind = classifyParcelStatus(shipment.shipmentStatus);
      const order = shipment.order;

      if (!kind || !order) return null;

      const address = order.shippingAddress || {};

      return {
        id: String(shipment._id),
        orderMongoId: String(order._id),
        orderId: order.orderId || '',
        kind,
        kindLabel: KINDS[kind],
        status: shipment.shipmentStatus,
        awbCode: shipment.awbCode || '',
        courierName: shipment.courierName || '',
        trackingUrl: shipment.trackingUrl || '',
        lastTrackedAt: shipment.lastTrackedAt || null,
        fullName: address.fullName || '',
        mobile: address.mobile || '',
        address: addressText(address),
        amount: Number(order.grandTotal || 0),
        paymentMethod: order.paymentMethod || '',
        isCod: order.paymentMethod === 'COD',
        orderStatus: order.orderStatus || ''
      };
    })
    .filter(Boolean);

  return ok(res, { parcels });
});

module.exports = { listReturnParcels };
