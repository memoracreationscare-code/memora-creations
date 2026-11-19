'use strict';

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const Module = require('module');
const fs = require('fs');
const path = require('path');
const { sanitizeRequest } = require('../backend/middleware/sanitize');

test('sanitize drops prototype-pollution keys', () => {
  const req = { body: JSON.parse('{"__proto__":{"admin":true},"constructor":{"x":1},"prototype":1,"name":"ok"}'), query: {}, params: {} };
  sanitizeRequest(req, {}, () => {});
  assert.deepStrictEqual(Object.keys(req.body), ['name']);
  assert.strictEqual({}.admin, undefined);
});

test('razorpay webhook check is constant-time and still verifies', () => {
  const orig = Module._load;
  Module._load = function (request, ...rest) {
    if (request === 'razorpay') return function Razorpay() {};
    return orig.call(this, request, ...rest);
  };
  try {
    process.env.RAZORPAY_WEBHOOK_SECRET = 'whsec';
    const { verifyWebhook } = require('../backend/services/paymentService');
    const body = Buffer.from('{"a":1}');
    const good = crypto.createHmac('sha256', 'whsec').update(body).digest('hex');
    assert.strictEqual(verifyWebhook(body, good), true);
    assert.strictEqual(verifyWebhook(body, good.slice(0, -1) + (good.endsWith('0') ? '1' : '0')), false);
    assert.strictEqual(verifyWebhook(body, 'short'), false);
    assert.strictEqual(verifyWebhook(body, undefined), false);
  } finally {
    Module._load = orig;
  }
  const src = fs.readFileSync(path.join(__dirname, '../backend/services/paymentService.js'), 'utf8');
  assert.ok(!/expected === signature/.test(src));
});

test('jwt sign/verify pin the algorithm and no Math.random in tokens', () => {
  const auth = fs.readFileSync(path.join(__dirname, '../backend/middleware/auth.js'), 'utf8');
  assert.strictEqual((auth.match(/algorithms: \['HS256'\]/g) || []).length, 2);
  assert.ok(/algorithm: 'HS256'/.test(auth));
  assert.ok(!/Math\.random/.test(fs.readFileSync(path.join(__dirname, '../backend/controllers/adminController.js'), 'utf8')));
});
