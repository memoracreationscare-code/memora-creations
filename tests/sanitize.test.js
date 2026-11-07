'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { sanitizeRequest } = require('../backend/middleware/sanitize');

test('removes $ operators and dotted keys from input', () => {
  const req = {
    body: { mobile: { $gt: '' }, name: 'Asha', 'a.b': 1, nested: [{ $ne: 1, ok: 2 }] },
    query: { category: { $ne: 'x' }, q: 'lamp' },
    params: { id: 'abc' }
  };
  let called = false;
  sanitizeRequest(req, {}, () => { called = true; });

  assert.ok(called);
  assert.deepStrictEqual(req.body.mobile, {});
  assert.strictEqual(req.body.name, 'Asha');
  assert.ok(!('a.b' in req.body));
  assert.deepStrictEqual(req.body.nested, [{ ok: 2 }]);
  assert.deepStrictEqual(req.query.category, {});
  assert.strictEqual(req.query.q, 'lamp');
});

test('leaves normal input untouched and tolerates missing parts', () => {
  const req = { body: { price: 10, tags: ['a', 'b'] } };
  sanitizeRequest(req, {}, () => {});
  assert.deepStrictEqual(req.body, { price: 10, tags: ['a', 'b'] });
});
