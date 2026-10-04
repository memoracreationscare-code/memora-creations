const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('./backend/server');

test('health endpoint confirms API and WhatsApp order disabled', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.whatsappOrder, false);
});

test('unknown API returns JSON 404', async () => {
  const res = await request(app).get('/api/does-not-exist');
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
});

test('protected cart rejects anonymous request', async () => {
  const res = await request(app).get('/api/cart');
  assert.equal(res.status, 401);
});
