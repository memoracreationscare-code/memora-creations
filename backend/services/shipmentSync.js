'use strict';

/*
=========================================
 MEMORA CREATIONS
 AUTOMATIC ORDER STATUS FROM SHIPROCKET

 Every 30 minutes the server asks Shiprocket
 about shipments that are still on the way
 and moves the order forward:

   Shipped -> Out for Delivery -> Delivered

 - The change shows in the admin panel and in
   the customer's order page (same fields the
   admin uses by hand).
 - Orders only ever move FORWARD.
 - Cancelled, returned (RTO), lost or damaged
   shipments are never touched: the owner
   decides those.
 - Payments, stock and coupons are not changed.

 Turn off with SHIPMENT_AUTO_SYNC=false
=========================================
*/

const ORDER = [
  'Order Placed',
  'Confirmed',
  'Packed',
  'Shipped',
  'Out for Delivery',
  'Delivered'
];

const NOTE = 'Updated automatically from Shiprocket tracking.';

/* What order status does this shipment say? (null = no change) */
function targetStatus(shipment) {
  const text = String(shipment?.shipmentStatus || '').trim();

  if (/rto|return|undeliver|cancel|lost|damag|destroy|reject/i.test(text)) {
    return null;
  }

  if (shipment?.deliveredAt || /^delivered$/i.test(text)) {
    return 'Delivered';
  }

  if (/out for delivery/i.test(text)) {
    return 'Out for Delivery';
  }

  if (
    shipment?.pickedUpAt ||
    /picked up|pickup done|in transit|shipped|dispatched|reached/i.test(text)
  ) {
    return 'Shipped';
  }

  return null;
}

/* Only move forward, never back, never out of Cancelled. */
function nextOrderStatus(current, shipment) {
  const target = targetStatus(shipment);

  if (!target) return null;

  const from = ORDER.indexOf(current);
  const to = ORDER.indexOf(target);

  if (from === -1 || to === -1 || to <= from) return null;

  return target;
}

async function syncShipments({ refresh, limit = 50 } = {}) {
  // Loaded here so the status rules above can be tested alone.
  const { Order, ShipmentTracking } = require('../models');
  const { configured } = require('./shiprocketService');

  if (!configured()) {
    return { checked: 0, updated: 0, skipped: 'not configured' };
  }

  const shipments = await ShipmentTracking.find({
    awbCode: { $nin: ['', null] }
  })
    .sort({ lastTrackedAt: 1 })
    .limit(limit * 4)
    .lean();

  let checked = 0;
  let updated = 0;

  for (const shipment of shipments) {
    if (checked >= limit) break;

    const order = await Order.findById(shipment.order)
      .select('orderStatus')
      .lean();

    if (
      !order ||
      order.orderStatus === 'Cancelled' ||
      order.orderStatus === 'Delivered'
    ) {
      continue;
    }

    checked += 1;

    const fresh = (await refresh(shipment)) || shipment;
    const status = nextOrderStatus(order.orderStatus, fresh);

    if (!status) continue;

    // Update only if the order is still in the state we read.
    const result = await Order.updateOne(
      { _id: order._id, orderStatus: order.orderStatus },
      {
        $set: { orderStatus: status },
        $push: {
          statusHistory: {
            status,
            note: NOTE,
            changedAt: new Date()
          }
        }
      }
    );

    if (result.modifiedCount) updated += 1;
  }

  return { checked, updated };
}

let timer = null;

function startShipmentSync() {
  if (timer || process.env.SHIPMENT_AUTO_SYNC === 'false') return;

  const { refreshShipmentTracking } =
    require('../controllers/shipmentTrackingController');

  const run = async () => {
    try {
      const result = await syncShipments({ refresh: refreshShipmentTracking });

      if (result.updated) {
        console.log('[Shipment Sync] orders updated:', result.updated);
      }
    } catch (err) {
      console.warn('[Shipment Sync] failed:', err.message);
    }
  };

  // First run a minute after start, then every 30 minutes.
  setTimeout(run, 60 * 1000).unref();
  timer = setInterval(run, 30 * 60 * 1000);
  timer.unref();
}

module.exports = {
  startShipmentSync,
  syncShipments,
  nextOrderStatus,
  targetStatus
};
