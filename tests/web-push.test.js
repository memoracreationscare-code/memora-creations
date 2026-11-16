const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const fs = require('fs');
const wp = require('../backend/services/webPush');

test('keys are a real P-256 pair and the public key is 65 bytes', () => {
  const k = wp.generateKeys();
  const raw = Buffer.from(k.publicKey.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  assert.equal(raw.length, 65);
  assert.equal(raw[0], 0x04);
  assert.match(k.privateKeyPem, /BEGIN PRIVATE KEY/);
});

test('VAPID header carries a JWT that verifies with the public key', () => {
  const k = wp.generateKeys();
  const h = wp.vapidAuthHeader('https://fcm.googleapis.com/fcm/send/abc', k, 'https://memoracreationscare.in', 1700000000000);
  const m = h.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.ok(m);
  assert.equal(m[2], k.publicKey);
  const [hd, cl, sig] = m[1].split('.');
  const claims = JSON.parse(Buffer.from(cl, 'base64url').toString());
  assert.equal(claims.aud, 'https://fcm.googleapis.com');
  assert.equal(claims.sub, 'https://memoracreationscare.in');
  assert.equal(claims.exp, 1700000000 + 43200);
  const raw = Buffer.from(k.publicKey, 'base64url');
  const pub = crypto.createPublicKey({
    key: { kty: 'EC', crv: 'P-256', x: raw.subarray(1, 33).toString('base64url'), y: raw.subarray(33).toString('base64url') },
    format: 'jwk'
  });
  assert.equal(
    crypto.verify('sha256', Buffer.from(hd + '.' + cl), { key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url')),
    true
  );
});

test('sendToAll counts sent / failed and lists dead subscriptions', async () => {
  const k = wp.generateKeys();
  const status = { 'https://a.example/1': 201, 'https://a.example/2': 410, 'https://a.example/3': 500 };
  const calls = [];
  const fakeFetch = async (url, opts) => {
    calls.push({ url, opts });
    return { status: status[url] };
  };
  const r = await wp.sendToAll(
    Object.keys(status).map(endpoint => ({ endpoint })), k, 'https://x.in', fakeFetch, 2
  );
  assert.equal(r.sent, 1);
  assert.equal(r.failed, 2);
  assert.deepEqual(r.gone, ['https://a.example/2']);
  assert.equal(calls[0].opts.method, 'POST');
  assert.equal(calls[0].opts.headers.TTL, '86400');
  assert.match(calls[0].opts.headers.Authorization, /^vapid t=/);
});

test('only https push endpoints are accepted', () => {
  assert.equal(wp.isPushEndpoint('https://fcm.googleapis.com/x'), true);
  assert.equal(wp.isPushEndpoint('http://evil.test/x'), false);
  assert.equal(wp.isPushEndpoint('nonsense'), false);
});

test('route wiring, link cleaning, service worker and admin page', () => {
  const Module = require('module');
  const orig = Module._load;
  Module._load = function (req, ...a) {
    if (req === 'express') return { Router: () => ({ get() {}, post() {} }) };
    if (/models\/Push|middleware\/auth/.test(req)) return { requireAdmin: (_q, _s, n) => n(), findOne: () => ({}) };
    return orig.call(this, req, ...a);
  };
  let routes;
  try { routes = require('../backend/routes/pushRoutes'); } finally { Module._load = orig; }
  assert.equal(routes.cleanUrl(''), '/frontend/index.html');
  assert.equal(routes.cleanUrl('/frontend/products.html'), '/frontend/products.html');
  assert.equal(routes.cleanUrl('//evil.com'), '/frontend/index.html');
  assert.equal(routes.cleanUrl('https://evil.com/x'), '/frontend/index.html');
  assert.equal(routes.cleanUrl('https://memoracreationscare.in/frontend/cart.html'), 'https://memoracreationscare.in/frontend/cart.html');

  const root = __dirname + '/../';
  assert.match(fs.readFileSync(root + 'backend/server.js', 'utf8'), /\/api\/push/);
  const sw = fs.readFileSync(root + 'frontend/sw.js', 'utf8');
  assert.match(sw, /addEventListener\('push'/);
  assert.match(sw, /notificationclick/);
  assert.match(fs.readFileSync(root + 'frontend/index.html', 'utf8'), /js\/push\.js/);
  const admin = fs.readFileSync(root + 'admin/notifications.html', 'utf8');
  assert.match(admin, /\/push\/admin\/send/);
  assert.match(fs.readFileSync(root + 'admin/dashboard.html', 'utf8'), /notifications\.html/);
});
