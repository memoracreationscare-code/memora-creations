
const crypto = require('crypto');

/*
 * MEMORA CREATIONS
 * Cashfree Webhook Signature Verification
 */

function verifyCashfreeWebhook({
  rawBody,
  signature,
  timestamp
}) {
  const secret = process.env.CASHFREE_CLIENT_SECRET;

  if (!secret || !signature || !timestamp) {
    return false;
  }

  if (!Buffer.isBuffer(rawBody)) {
    return false;
  }

  const timestampText = String(timestamp);

  if (!/^\d+$/.test(timestampText)) {
    return false;
  }

  const suppliedSignature = String(signature);

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(timestampText)
    .update(rawBody)
    .digest('base64');

  const expectedBuffer = Buffer.from(
    expectedSignature,
    'utf8'
  );

  const suppliedBuffer = Buffer.from(
    suppliedSignature,
    'utf8'
  );

  if (
    expectedBuffer.length !==
    suppliedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    expectedBuffer,
    suppliedBuffer
  );
}

module.exports = {
  verifyCashfreeWebhook
};
