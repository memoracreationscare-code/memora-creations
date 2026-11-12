'use strict';

/*
  A simple warning for the owner before shipping a Cash-on-Delivery order.
  It only COUNTS facts (never blocks anything):
    - how many earlier orders of this customer (same account or same mobile)
      were cancelled or had a return request,
    - high COD amount, a very short address, first-time customer.
  Level: HIGH, MEDIUM or LOW, with the reasons in plain words.
*/

const HIGH_COD_AMOUNT = 2000;

function riskOf(order, history = []) {
  const reasons = [];
  let score = 0;

  const cancelled = history.filter(o => o.orderStatus === 'Cancelled').length;
  const returned = history.filter(o => o.returnRequest && o.returnRequest.status).length;
  const delivered = history.filter(o => o.orderStatus === 'Delivered' && !(o.returnRequest && o.returnRequest.status)).length;
  const isCod = order.paymentMethod === 'COD';

  if (cancelled >= 1) {
    reasons.push(`Pehle ${cancelled} order cancel hue hain`);
    score += cancelled >= 2 ? 2 : 1;
  }

  if (returned >= 1) {
    reasons.push(`Pehle ${returned} order me return maanga gaya`);
    score += returned >= 2 ? 2 : 1;
  }

  if (isCod && Number(order.grandTotal) >= HIGH_COD_AMOUNT) {
    reasons.push(`COD amount zyada hai (₹${Math.round(order.grandTotal)})`);
    score += 1;
  }

  const address = String((order.shippingAddress && order.shippingAddress.addressLine) || '').trim();

  if (address.length < 10) {
    reasons.push('Address bahut chhota / adhoora lag raha hai');
    score += 1;
  }

  if (isCod && history.length === 0) {
    reasons.push('Naya customer, pehla COD order');
    score += 1;
  }

  const trusted = delivered >= 2 && cancelled === 0 && returned === 0;

  if (trusted) {
    reasons.length = 0;
    reasons.push(`Bharosemand customer: ${delivered} order pehle deliver ho chuke`);
    score = 0;
  }

  const level = score >= 3 ? 'HIGH' : score >= 1 ? 'MEDIUM' : 'LOW';

  return { level, score, reasons, trusted };
}

async function riskForOrder(orderId, models) {
  const order = await models.Order.findById(orderId)
    .select('user paymentMethod grandTotal shippingAddress').lean();

  if (!order) return null;

  const mobile = order.shippingAddress && order.shippingAddress.mobile;
  const who = [];

  if (order.user) who.push({ user: order.user });
  if (mobile) who.push({ 'shippingAddress.mobile': mobile });

  const history = who.length
    ? await models.Order.find({ _id: { $ne: order._id }, $or: who })
        .select('orderStatus returnRequest.status').limit(100).lean()
    : [];

  return riskOf(order, history);
}

module.exports = { riskOf, riskForOrder, HIGH_COD_AMOUNT };
