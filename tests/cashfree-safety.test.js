'use strict';

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

process.env.CASHFREE_CLIENT_SECRET = 'test_secret_123';

const { verifyCashfreeWebhook } = require('../backend/services/cashfreeWebhookService');

const sign = (ts, body, secret = 'test_secret_123') =>
  crypto.createHmac('sha256', secret).update(String(ts)).update(body).digest('base64');

test('webhook: a correctly signed body is accepted', () => {
  const body = Buffer.from('{"type":"PAYMENT_SUCCESS_WEBHOOK"}');
  assert.strictEqual(verifyCashfreeWebhook({ rawBody: body, timestamp: '1700000000000', signature: sign('1700000000000', body) }), true);
});

test('webhook: wrong secret, changed body, missing or bad headers are rejected', () => {
  const body = Buffer.from('{"amount":100}');
  const ts = '1700000000000';
  const good = sign(ts, body);
  assert.strictEqual(verifyCashfreeWebhook({ rawBody: body, timestamp: ts, signature: sign(ts, body, 'other') }), false);
  assert.strictEqual(verifyCashfreeWebhook({ rawBody: Buffer.from('{"amount":1}'), timestamp: ts, signature: good }), false);
  assert.strictEqual(verifyCashfreeWebhook({ rawBody: body, timestamp: '1700000000001', signature: good }), false);
  assert.strictEqual(verifyCashfreeWebhook({ rawBody: body, timestamp: ts, signature: '' }), false);
  assert.strictEqual(verifyCashfreeWebhook({ rawBody: body, timestamp: '', signature: good }), false);
  assert.strictEqual(verifyCashfreeWebhook({ rawBody: body, timestamp: 'abc', signature: good }), false);
  assert.strictEqual(verifyCashfreeWebhook({ rawBody: body.toString(), timestamp: ts, signature: good }), false); // must be raw bytes
});

test('webhook: nothing is accepted when the secret is not configured', () => {
  const saved = process.env.CASHFREE_CLIENT_SECRET;
  delete process.env.CASHFREE_CLIENT_SECRET;
  const body = Buffer.from('x');
  assert.strictEqual(verifyCashfreeWebhook({ rawBody: body, timestamp: '1', signature: sign('1', body, '') }), false);
  process.env.CASHFREE_CLIENT_SECRET = saved;
});

let svc = null;
try { svc = require('../backend/services/cashfreeService'); } catch (_) { /* needs packages not installed in a bare sandbox */ }

test('payment is confirmed only for PAID, INR and the exact amount', { skip: !svc }, () => {
  const ok = { order_status: 'PAID', order_currency: 'INR', order_amount: 498 };
  const f = svc.isCashfreePaymentSuccessful;
  assert.strictEqual(f(ok, 498), true);
  assert.strictEqual(f(ok, 498.0), true);
  assert.strictEqual(f({ ...ok, order_amount: 497.99 }, 498), false, 'short payment');
  assert.strictEqual(f({ ...ok, order_amount: 498.01 }, 498), false, 'overpayment needs review');
  assert.strictEqual(f({ ...ok, order_status: 'ACTIVE' }, 498), false, 'not paid yet');
  assert.strictEqual(f({ ...ok, order_status: 'EXPIRED' }, 498), false);
  assert.strictEqual(f({ ...ok, order_currency: 'USD' }, 498), false);
  assert.strictEqual(f({ ...ok, order_amount: '498.00' }, 498), true, 'string amounts from the API');
  assert.strictEqual(f(ok, undefined), false);
  assert.strictEqual(f(null, 498), false);
});
