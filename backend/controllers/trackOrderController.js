'use strict';

/*
  POST /api/track-order   { orderId: "MC...", mobile: "9876543210" }

  Public "where is my order" lookup. No login: the order number plus the
  mobile number used at checkout together act as the key. Strict rate
  limit, identical answer for "no such order" and "wrong mobile", and only
  a safe summary is returned (no address, email, payment or admin notes).
*/

const mongoose = require('mongoose');

const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function safeHttps(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' ? u.href : null;
  } catch (_) {
    return null;
  }
}

const NOT_FOUND = {
  success: false,
  message: 'Order nahi mila. Order number aur checkout wala mobile number dubara check karein.'
};

async function trackOrder(req, res, deps = {}) {
  res.set('Cache-Control', 'no-store');

  const models = deps.models || require('../models');
  const refresh = deps.refresh ||
    require('./shipmentTrackingController').refreshShipmentTracking;

  const orderId = clean((req.body || {}).orderId, 60);
  const mobile = clean((req.body || {}).mobile, 20).replace(/\D/g, '').slice(-10);

  if (!/^[A-Za-z0-9_-]{4,60}$/.test(orderId) || !/^[6-9]\d{9}$/.test(mobile)) {
    return res.status(400).json({
      success: false,
      message: 'Sahi order number aur 10 ankon ka mobile number daalein.'
    });
  }

  const order = await models.Order.findOne({ orderId, 'shippingAddress.mobile': mobile })
    .select('_id orderId orderStatus createdAt statusHistory items.name items.quantity')
    .lean();

  if (!order) return res.status(404).json(NOT_FOUND);

  let shipment = await models.ShipmentTracking.findOne({ order: order._id }).lean();

  if (shipment && shipment.awbCode) {
    try { shipment = await refresh(shipment); } catch (_) { /* keep cached data */ }
  }

  return res.json({
    success: true,
    orderId: order.orderId,
    orderStatus: order.orderStatus,
    placedAt: order.createdAt,
    items: (order.items || []).slice(0, 20).map(i => ({ name: i.name, quantity: i.quantity })),
    history: (order.statusHistory || [])
      .filter(h => h && h.status)
      .map(h => ({ status: h.status, at: h.changedAt })),
    shipment: shipment && shipment.awbCode ? {
      courierName: shipment.courierName || null,
      awbCode: shipment.awbCode,
      trackingUrl: safeHttps(shipment.trackingUrl),
      status: shipment.shipmentStatus || null,
      estimatedDeliveryDate: shipment.estimatedDeliveryDate || null,
      deliveredAt: shipment.deliveredAt || null
    } : null
  });
}

module.exports = { trackOrder };
