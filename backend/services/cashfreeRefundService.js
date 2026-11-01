/* MEMORA CREATIONS — Cashfree refund inspection only. No mutations. */
const { getCashfreeConfig, fetchCashfreeOrder, isCashfreePaymentSuccessful } = require('./cashfreeService');

async function getCashfreeRefunds(orderId) {
  if (!/^[A-Za-z0-9_-]{3,100}$/.test(String(orderId || ''))) {
    const e = new Error('Invalid Cashfree order reference.'); e.statusCode = 400; throw e;
  }
  const config = getCashfreeConfig();
  let response;
  try {
    response = await fetch(`${config.baseUrl}/orders/${encodeURIComponent(orderId)}/refunds`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-client-id': config.clientId,
        'x-client-secret': config.clientSecret,
        'x-api-version': '2023-08-01'
      },
      signal: AbortSignal.timeout(20000)
    });
  } catch (_) {
    const e = new Error('Cashfree refund status is temporarily unavailable.'); e.statusCode = 502; throw e;
  }
  if (!response.ok) {
    const e = new Error('Cashfree could not verify refund status.'); e.statusCode = 502; throw e;
  }
  let data;
  try { data = await response.json(); } catch (_) {
    const e = new Error('Invalid Cashfree refund response.'); e.statusCode = 502; throw e;
  }
  if (!Array.isArray(data)) {
    const e = new Error('Unexpected Cashfree refund response.'); e.statusCode = 502; throw e;
  }
  return data;
}

module.exports = { getCashfreeRefunds, fetchCashfreeOrder, isCashfreePaymentSuccessful };
