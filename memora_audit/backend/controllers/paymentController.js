const { Order, Cart } = require('../models');
const { asyncHandler, error, ok } = require('../utils/http');
const { validateAddress } = require('../utils/validation');
const { getTrustedItems, totals, createOnlinePendingOrder, cancelPendingOnlineOrder, reserveStock, releaseStock } = require('../services/orderService');
const { getRazorpay, verifySignature } = require('../services/paymentService');

const createOrder = asyncHandler(async (req, res) => {
  const address = req.body.address; const msg = validateAddress(address); if (msg) throw error(400, msg);
  const trusted = await getTrustedItems(req.body.items); const t = totals(trusted);
  if (t.grandTotal <= 0) throw error(400, 'Invalid order total.');
  const razorpay = getRazorpay();
  const receipt = `MC${Date.now()}`;
  const rpOrder = await razorpay.orders.create({ amount: Math.round(t.grandTotal * 100), currency: 'INR', receipt, notes: { customer_mobile: req.user.mobile } });
  try {
    const order = await createOnlinePendingOrder({ user: req.user, address, items: req.body.items, razorpayOrderId: rpOrder.id, clearCart: req.body.clearCart === true });
    return ok(res, { keyId: process.env.RAZORPAY_KEY_ID, razorpayOrderId: rpOrder.id, amount: rpOrder.amount, currency: rpOrder.currency, orderId: order._id, merchantOrderId: order.orderId });
  } catch (e) {
    try { await razorpay.orders.cancel?.(rpOrder.id); } catch (_) {}
    throw e;
  }
});

const verify = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) throw error(400, 'Incomplete payment response.');
  const order = await Order.findOne({ _id: orderId, user: req.user._id }); if (!order) throw error(404, 'Order not found.');
  if (order.razorpayOrderId !== razorpay_order_id) throw error(400, 'Payment order mismatch.');
  if (!verifySignature({ orderId: razorpay_order_id, paymentId: razorpay_payment_id, signature: razorpay_signature })) {
    order.paymentStatus = 'FAILED';
    await order.save();
    await cancelPendingOnlineOrder(order);
    throw error(400, 'Payment signature verification failed.');
  }
  const razorpay = getRazorpay();
  const payment = await razorpay.payments.fetch(razorpay_payment_id);
  const expectedAmount = Math.round(order.grandTotal * 100);
  if (payment.order_id !== razorpay_order_id || Number(payment.amount) !== expectedAmount || payment.currency !== 'INR') {
    order.paymentStatus = 'FAILED';
    await order.save();
    await cancelPendingOnlineOrder(order);
    throw error(400, 'Payment details do not match the order.');
  }
  if (payment.status !== 'captured' && payment.captured !== true) {
    order.paymentStatus = 'PENDING';
    await order.save();
    throw error(400, 'Payment has not been captured yet.');
  }
  order.paymentStatus = 'SUCCESS'; order.razorpayPaymentId = razorpay_payment_id; order.orderStatus = 'Order Placed';
  order.statusHistory.push({ status: 'Order Placed', note: 'Online payment verified successfully.' });
  await order.save();
  if (order.clearCartOnPayment === true) await Cart.updateOne({ user: req.user._id }, { $set: { items: [] } });
  return ok(res, { message: 'Payment verified and order confirmed.', order });
});

const fail = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.body.orderId, user: req.user._id }); if (!order) throw error(404, 'Order not found.');
  order.paymentStatus = 'FAILED';
  await cancelPendingOnlineOrder(order);
  const fresh = await Order.findById(order._id);
  return ok(res, { message: 'Payment marked as failed.', order: fresh });
});

const retry = asyncHandler(async (req,res)=>{
  const order=await Order.findOne({_id:req.params.id,user:req.user._id,paymentMethod:'RAZORPAY'});
  if(!order) throw error(404,'Order not found.');
  if(order.paymentStatus==='SUCCESS') throw error(400,'This order is already paid.');
  if(order.orderStatus==='Cancelled') throw error(400,'Cancelled order cannot be retried.');
  if(order.orderStatus==='Delivered') throw error(400,'Order cannot be retried.');
  if(order.stockReserved) {
    const e=error(409,'Payment attempt is still active. Please complete it or wait.'); throw e;
  }
  const razorpay=getRazorpay();
  const rpOrder=await razorpay.orders.create({amount:Math.round(order.grandTotal*100),currency:'INR',receipt:`retry_${order.orderId}_${Date.now()}`});
  const mongoose=require('mongoose'); const session=await mongoose.startSession();
  try { await session.withTransaction(async()=>{ await reserveStock(order,session); order.razorpayOrderId=rpOrder.id; order.razorpayPaymentId=undefined; order.paymentStatus='PENDING'; order.orderStatus='Order Placed'; order.statusHistory.push({status:'Order Placed',note:'Payment retry initiated.'}); await order.save({session}); }); } finally { await session.endSession(); }
  return ok(res,{keyId:process.env.RAZORPAY_KEY_ID,razorpayOrderId:rpOrder.id,amount:rpOrder.amount,currency:rpOrder.currency,orderId:order._id,merchantOrderId:order.orderId});
});
module.exports = { createOrder, verify, fail, retry };

const webhook = asyncHandler(async (req,res)=>{
  const signature=req.headers['x-razorpay-signature'];
  const { verifyWebhook }=require('../services/paymentService');
  if(!process.env.RAZORPAY_WEBHOOK_SECRET) throw error(503,'Razorpay webhook secret is not configured.');
  if(!verifyWebhook(req.body,signature)) throw error(400,'Invalid webhook signature.');
  let event; try{event=JSON.parse(req.body.toString('utf8'));}catch{throw error(400,'Invalid webhook body.');}
  const payment=event.payload?.payment?.entity; const rpOrderId=payment?.order_id || event.payload?.order?.entity?.id;
  if(rpOrderId){const order=await Order.findOne({razorpayOrderId:rpOrderId});if(order){if(order.razorpayEventId===event.id)return res.json({success:true}); if(event.event==='payment.captured' || event.event==='order.paid'){order.paymentStatus='SUCCESS';if(payment?.id)order.razorpayPaymentId=payment.id;order.razorpayEventId=event.id;await order.save();if(order.clearCartOnPayment===true)await Cart.updateOne({user:order.user},{$set:{items:[]}});}else if(event.event==='payment.failed'){order.paymentStatus='FAILED';order.razorpayEventId=event.id;await cancelPendingOnlineOrder(order);}}}
  return res.json({success:true});
});
module.exports.webhook=webhook;
