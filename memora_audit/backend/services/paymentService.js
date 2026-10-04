const crypto = require('crypto');
const Razorpay = require('razorpay');

function getRazorpay() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    const e = new Error('Razorpay credentials are not configured.');
    e.statusCode = 503;
    throw e;
  }
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
}

function verifySignature({ orderId, paymentId, signature }) {
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  const provided=String(signature||''); if(provided.length!==expected.length) return false; return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

function verifyWebhook(rawBody, signature) {
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || '')
    .update(rawBody)
    .digest('hex');
  return expected === signature;
}

module.exports = { getRazorpay, verifySignature, verifyWebhook };
