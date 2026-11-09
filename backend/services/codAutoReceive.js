'use strict';

/*
  Shiprocket pays the cash it collected from the customer to your bank
  a few days after delivery. There is no Shiprocket API to read that
  payment, so this marks a delivered COD order as "payment received"
  by itself, N days after delivery.

  Set COD_AUTO_RECEIVE_DAYS in Render (for example 8). 0 or empty = off.
  The COD Remittance page still shows each order, and you can compare it
  with Shiprocket -> Billing -> COD Remittance.
*/

const DAY = 24 * 60 * 60 * 1000;

function days() {
  const n = Number(require('./settingsService').peek().codAutoReceiveDays);

  return Number.isFinite(n) && n >= 1 && n <= 60 ? Math.floor(n) : 0;
}

function deliveredAt(order) {
  const h = (order.statusHistory || []).filter(x => x.status === 'Delivered');

  return h.length ? new Date(h[h.length - 1].changedAt) : null;
}

async function autoReceiveCod(Order = require('../models').Order, now = new Date()) {
  const wait = days();

  if (!wait) return { updated: 0 };

  const candidates = await Order.find({
    orderStatus: 'Delivered',
    $or: [
      { paymentMethod: 'COD', paymentStatus: 'COD_PENDING' },
      { 'codAdvance.enabled': true, 'codAdvance.balanceStatus': 'PENDING' }
    ]
  })
    .select('paymentMethod paymentStatus codAdvance statusHistory')
    .limit(200)
    .lean();

  let updated = 0;

  for (const order of candidates) {
    const at = deliveredAt(order);

    if (!at || now.getTime() - at.getTime() < wait * DAY) continue;

    const advance = order.codAdvance && order.codAdvance.enabled === true;

    const result = await Order.updateOne(
      advance
        ? { _id: order._id, 'codAdvance.balanceStatus': 'PENDING' }
        : { _id: order._id, paymentStatus: 'COD_PENDING' },
      {
        $set: advance
          ? { 'codAdvance.balanceStatus': 'RECEIVED', 'codAdvance.balanceReceivedAt': now }
          : { paymentStatus: 'SUCCESS' },
        $push: {
          statusHistory: {
            status: 'Delivered',
            note: `COD money marked received automatically ${wait} days after delivery.`,
            changedAt: now
          }
        }
      }
    );

    if (result.modifiedCount) updated += 1;
  }

  return { updated };
}

module.exports = { autoReceiveCod, days };
