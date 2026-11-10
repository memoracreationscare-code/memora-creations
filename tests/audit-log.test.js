'use strict';

const test = require('node:test');
const assert = require('node:assert');
const Module = require('module');

const created = [];
const realLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === '../models') return { ActivityLog: { create: async d => { created.push(d); } } };
  return realLoad.call(this, req, ...rest);
};
const { auditLog, describe } = require('../backend/middleware/auditLog');

// the middleware loads the model lazily, so keep the stub until the tests end
test.after(() => { Module._load = realLoad; });

const id = 'a'.repeat(24);

test('known actions get a readable label and the record id', () => {
  assert.deepStrictEqual(describe('POST', `/payments/${id}/refund`), { action: 'Online payment refund kiya', targetId: id });
  assert.strictEqual(describe('PUT', `/orders/${id}`).action, 'Order status / details badle');
  assert.strictEqual(describe('PUT', `/orders/${id}/note`).action, 'Order par note likha');
  assert.strictEqual(describe('POST', '/something/new').action, 'POST /something/new');
});

function run(method, status, body) {
  const handlers = {};
  const req = { method, originalUrl: `/api/admin/orders/${id}`, admin: { email: 'owner@x.com' }, ip: '1.2.3.4', body };
  const res = { statusCode: status, on: (e, f) => { handlers[e] = f; } };
  let called = false;
  auditLog(req, res, () => { called = true; });
  handlers.finish?.();
  return called;
}

test('changes are logged without the request body; reads and failures are not', async () => {
  created.length = 0;
  assert.ok(run('PUT', 200, { password: 'secret' }));
  run('GET', 200);
  run('PUT', 500);
  await new Promise(r => setImmediate(r));
  assert.strictEqual(created.length, 1);
  assert.strictEqual(created[0].admin, 'owner@x.com');
  assert.strictEqual(created[0].targetId, id);
  assert.ok(!JSON.stringify(created[0]).includes('secret'));
});
