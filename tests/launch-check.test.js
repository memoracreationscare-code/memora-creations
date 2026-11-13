'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { buildChecks } = require('../backend/controllers/adminLaunchCheckController');

const goodEnv = {
  CASHFREE_ENV: 'production', CASHFREE_CLIENT_ID: 'a', CASHFREE_CLIENT_SECRET: 'b',
  SHIPROCKET_EMAIL: 'e', SHIPROCKET_PASSWORD: 'p', SHIPROCKET_LIVE_SHIPMENTS_ENABLED: 'true',
  CLOUDINARY_CLOUD_NAME: 'c', CLOUDINARY_API_KEY: 'k', CLOUDINARY_API_SECRET: 's',
  JWT_SECRET: 'x'.repeat(40), SHIPROCKET_PICKUP_LOCATION: 'Home'
};
const goodFacts = { mailConfigured: true, storeOpen: true, activeProducts: 5, withoutPhoto: 0, testOrders: 0 };
const level = (checks, id) => checks.find(c => c.id === id).level;

test('a fully ready shop has no problems', () => {
  assert.ok(buildChecks(goodEnv, goodFacts).every(c => c.level === 'ok'));
});

test('sandbox Cashfree is the loudest warning', () => {
  const checks = buildChecks({ ...goodEnv, CASHFREE_ENV: undefined }, goodFacts);
  assert.strictEqual(level(checks, 'cashfree-mode'), 'bad');
});

test('missing pieces are flagged; secrets are never echoed', () => {
  const checks = buildChecks({ ...goodEnv, JWT_SECRET: 'short', SHIPROCKET_LIVE_SHIPMENTS_ENABLED: '' },
    { ...goodFacts, mailConfigured: false, activeProducts: 3, withoutPhoto: 1, testOrders: 7 });
  assert.strictEqual(level(checks, 'security'), 'bad');
  assert.strictEqual(level(checks, 'shiprocket-live'), 'warn');
  assert.strictEqual(level(checks, 'email'), 'warn');
  assert.strictEqual(level(checks, 'products'), 'warn');
  assert.match(checks.find(c => c.id === 'test-orders').detail, /7 order/);
  assert.ok(!JSON.stringify(checks).includes('short'));
});

test('no products at all is a problem', () => {
  assert.strictEqual(level(buildChecks(goodEnv, { ...goodFacts, activeProducts: 0 }), 'products'), 'bad');
});

test('integration checks: pickup, auto-sync, backend address, AI chat key', () => {
  const env = { ...goodEnv, SHIPROCKET_PICKUP_LOCATION: '', SHIPMENT_AUTO_SYNC: 'false' };
  const checks = buildChecks(env, { ...goodFacts, apiHost: 'memora-creations.onrender.com', chatEnabled: true, chatKey: false });
  assert.strictEqual(level(checks, 'shiprocket-pickup'), 'warn');
  assert.strictEqual(level(checks, 'auto-sync'), 'warn');
  assert.strictEqual(level(checks, 'api-domain'), 'warn');
  assert.strictEqual(level(checks, 'ai-chat'), 'bad');
});

test('own api domain and a working AI chat are green', () => {
  const checks = buildChecks(goodEnv, { ...goodFacts, apiHost: 'api.memoracreationscare.in', chatEnabled: true, chatKey: true });
  assert.ok(checks.every(c => c.level === 'ok'));
  assert.strictEqual(level(checks, 'api-domain'), 'ok');
});
