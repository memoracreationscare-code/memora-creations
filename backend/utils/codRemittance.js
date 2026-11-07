'use strict';

/*
  Sorts Cash-on-Delivery orders by where the money is.

    atCourier   - shipped, the courier is still carrying the parcel
    awaiting    - delivered, the cash is not yet marked as received
    received    - delivered and marked as received by the owner
    notCollected- returned, undelivered or lost, no cash was collected
    notShipped  - COD order that has not been shipped yet

  Amounts are the order totals the customer pays. Shiprocket deducts
  its shipping and COD charges before paying out, so the real
  payout is smaller.
*/

const { classifyParcelStatus } = require('./returnParcels');

const REMIT_DAYS_MIN = 8;
const REMIT_DAYS_MAX = 9;
const DAY = 24 * 60 * 60 * 1000;

function deliveredDate(order, shipment) {
  if (shipment?.deliveredAt) return new Date(shipment.deliveredAt);

  const entry = [...(order.statusHistory || [])]
    .reverse()
    .find(item => item.status === 'Delivered');

  return entry?.changedAt ? new Date(entry.changedAt) : null;
}

function classifyCodOrder(order, shipment, now = new Date()) {
  const problem = classifyParcelStatus(shipment?.shipmentStatus);

  let stage;

  if (order.orderStatus === 'Delivered') {
    stage = order.paymentStatus === 'SUCCESS' ? 'received' : 'awaiting';
  } else if (problem) {
    stage = 'notCollected';
  } else if (['Shipped', 'Out for Delivery'].includes(order.orderStatus)) {
    stage = 'atCourier';
  } else {
    stage = 'notShipped';
  }

  const delivered = deliveredDate(order, shipment);

  const result = { stage, deliveredAt: delivered, expectedFrom: null, expectedTo: null, daysSinceDelivery: null };

  if (delivered && !Number.isNaN(delivered.getTime())) {
    result.daysSinceDelivery = Math.max(0, Math.floor((now - delivered) / DAY));

    if (stage === 'awaiting') {
      result.expectedFrom = new Date(delivered.getTime() + REMIT_DAYS_MIN * DAY);
      result.expectedTo = new Date(delivered.getTime() + REMIT_DAYS_MAX * DAY);
    }
  }

  return result;
}

function summarize(rows) {
  const totals = {
    atCourier: 0, awaiting: 0, received: 0, notCollected: 0, notShipped: 0
  };
  const counts = { ...totals };

  rows.forEach(row => {
    totals[row.stage] += Number(row.amount || 0);
    counts[row.stage] += 1;
  });

  return { totals, counts };
}

module.exports = { classifyCodOrder, summarize, REMIT_DAYS_MIN, REMIT_DAYS_MAX };
