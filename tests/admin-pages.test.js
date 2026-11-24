'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const Module = require('node:module');

const store = {};
const stubs = {
  '../models/PageContent': {
    find: () => ({ select: () => ({ lean: async () => Object.entries(store).map(([slug, body]) => ({ slug, body })) }) }),
    findOne: q => ({ select: () => ({ lean: async () => (q.slug in store ? { body: store[q.slug] } : null) }), lean: async () => (q.slug in store ? { body: store[q.slug] } : null) }),
    findOneAndUpdate: async (q, op) => { store[q.slug] = op.$set.body; }
  }
};
const orig = Module._load;
Module._load = function (request, ...rest) {
  if (Object.prototype.hasOwnProperty.call(stubs, request)) return stubs[request];
  return orig.call(this, request, ...rest);
};
test.after(() => { Module._load = orig; });

const ctl = require('../backend/controllers/adminPagesController');
const call = (fn, params, body) => new Promise(resolve => {
  const res = { json: b => resolve({ ok: true, b }), status() { return res; } };
  fn({ params, body }, res, err => resolve({ err }));
});

test('only the five known pages can be read or written', async () => {
  assert.strictEqual((await call(ctl.get, { slug: 'index' })).err.statusCode, 404);
  assert.strictEqual((await call(ctl.put, { slug: '../x' }, { body: 'a' })).err.statusCode, 404);
});

test('save, read back, list, and reset to built-in', async () => {
  const saved = await call(ctl.put, { slug: 'terms' }, { body: '# Niyam\r\n\r\n- ek' });
  assert.strictEqual(saved.b.custom, true);
  assert.strictEqual((await call(ctl.get, { slug: 'terms' })).b.body, '# Niyam\n\n- ek');
  const list = (await call(ctl.list, {})).b.pages;
  assert.strictEqual(list.find(p => p.slug === 'terms').custom, true);
  assert.strictEqual(list.find(p => p.slug === 'about').custom, false);
  const reset = await call(ctl.put, { slug: 'terms' }, { body: '   ' });
  assert.strictEqual(reset.b.custom, false);
});

test('too long or non-text bodies are refused', async () => {
  assert.strictEqual((await call(ctl.put, { slug: 'about' }, { body: 'x'.repeat(20001) })).err.statusCode, 400);
  assert.strictEqual((await call(ctl.put, { slug: 'about' }, { body: { $gt: '' } })).err.statusCode, 400);
});

test('wired: routes, owner-only, public route, page script, no innerHTML', () => {
  const routes = fs.readFileSync('backend/routes/adminRoutes.js', 'utf8');
  assert.match(routes, /put\('\/pages\/:slug'/);
  const { ALLOWED } = require('../backend/middleware/staffGuard');
  assert.ok(!ALLOWED.some(([, re]) => re.test('/pages') || re.test('/pages/terms')));
  assert.match(fs.readFileSync('backend/routes/settingsRoutes.js', 'utf8'), /get\('\/pages\/:slug'/);
  const js = fs.readFileSync('frontend/js/page-text.js', 'utf8');
  assert.doesNotMatch(js, /innerHTML/);
  for (const f of ['shipping-policy', 'return-refund-policy', 'privacy-policy', 'terms', 'about']) {
    assert.match(fs.readFileSync(`frontend/${f}.html`, 'utf8'), /page-text\.js\?v=1/, f);
  }
  assert.ok(fs.existsSync('admin/pages.html'));
  assert.match(fs.readFileSync('admin/js/nav.js', 'utf8'), /pages\.html/);
});
