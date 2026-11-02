const { getCashfreeConfig } = require('./cashfreeService');

async function sendSandboxRefund({ orderId, refundId, amount }) {
  const cfg = getCashfreeConfig();
  if (cfg.env !== 'sandbox' || process.env.CASHFREE_SANDBOX_REFUNDS_ENABLED !== 'true') {
    const err = new Error('Sandbox refund initiation is disabled.'); err.statusCode = 403; throw err;
  }
  let response;
  try {
    response = await fetch(cfg.baseUrl + '/orders/' + encodeURIComponent(orderId) + '/refunds', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-client-id': cfg.clientId,
        'x-client-secret': cfg.clientSecret,
        'x-api-version': '2023-08-01',
        'x-idempotency-key': refundId
      },
      body: JSON.stringify({
        refund_id: refundId,
        refund_amount: amount,
        refund_note: 'Memora customer requested cancellation: sandbox full refund',
        refund_speed: 'STANDARD'
      }),
      signal: AbortSignal.timeout(20000)
    });
  } catch (_) { throw new Error('Cashfree response uncertain. Check refund status before any action.'); }
  let data;
  try { data = await response.json(); } catch (_) {
    throw new Error('Cashfree response unreadable. Check refund status before any action.');
  }
  if (!response.ok) {
    throw new Error('Cashfree rejected or could not confirm refund. Verify status before any action.');
  }
  if (String(data.refund_id || '') !== refundId ||
      String(data.order_id || '') !== orderId ||
      Math.round(Number(data.refund_amount) * 100) !== Math.round(amount * 100)) {
    throw new Error('Refund response mismatch. Manual review required.');
  }
  return data;
}
module.exports = { sendSandboxRefund };
