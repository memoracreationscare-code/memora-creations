const test = require('node:test');
const assert = require('node:assert');
const ka = require('../backend/services/keepAwake');

test('visits count, plain health checks do not', () => {
  assert.equal(ka.isVisit({ path: '/api/products' }), true);
  assert.equal(ka.isVisit({ path: '/api/health', query: {} }), false);
  assert.equal(ka.isVisit({ path: '/api/health', query: { visit: '1' } }), true);
});

test('pings only while there was a recent visit', () => {
  ka._reset(0);
  assert.equal(ka.shouldPing(Date.now(), {}), false);
  ka.markActivity({ path: '/api/products' }, {}, () => {});
  assert.equal(ka.shouldPing(Date.now(), {}), true);
  assert.equal(ka.shouldPing(Date.now() + 31 * 60 * 1000, {}), false);
  assert.equal(ka.shouldPing(Date.now() + 31 * 60 * 1000, { KEEP_AWAKE_MINUTES: '60' }), true);
});

test('start needs a public URL and can be switched off', () => {
  const f = () => Promise.resolve();
  assert.equal(ka.start({ env: {}, fetchImpl: f }), null);
  assert.equal(ka.start({ env: { RENDER_EXTERNAL_URL: 'https://x.onrender.com', KEEP_AWAKE: 'off' }, fetchImpl: f }), null);
  const t = ka.start({ env: { RENDER_EXTERNAL_URL: 'https://x.onrender.com/' }, fetchImpl: f });
  assert.ok(t);
  clearInterval(t);
  assert.equal(ka.baseUrl({ RENDER_EXTERNAL_URL: 'https://x.onrender.com/' }), 'https://x.onrender.com');
});

test('server wires the middleware and the frontend wakes the server', () => {
  const fs = require('fs');
  assert.match(fs.readFileSync(__dirname + '/../backend/server.js', 'utf8'), /keepAwake'\)\.markActivity/);
  assert.match(fs.readFileSync(__dirname + '/../frontend/js/app.js', 'utf8'), /health\?visit=1/);
});
