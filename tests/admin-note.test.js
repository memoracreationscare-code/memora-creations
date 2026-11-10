'use strict';

const test = require('node:test');
const assert = require('node:assert');
const Module = require('module');

const calls = [];
const realLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === 'mongoose') return { isValidObjectId: id => /^[a-f0-9]{24}$/.test(String(id)) };
  if (req === '../models') {
    return { Order: { findByIdAndUpdate: (id, update) => { calls.push(update); return { select: async () => ({ adminNote: update.$set?.adminNote }) }; } } };
  }
  return realLoad.call(this, req, ...rest);
};
const { saveNote } = require('../backend/controllers/adminNoteController');
Module._load = realLoad;

const run = (id, body) => new Promise(resolve => {
  const res = { status() { return this; }, json: x => resolve(x) };
  saveNote({ params: { id }, body }, res, e => resolve({ error: e.message || e }));
});

test('note is saved trimmed, and empty text removes it', async () => {
  const id = 'a'.repeat(24);
  const saved = await run(id, { text: '  call after Sunday  ' });
  assert.strictEqual(calls[0].$set.adminNote.text, 'call after Sunday');
  assert.ok(saved.success !== false);
  await run(id, { text: '   ' });
  assert.deepStrictEqual(calls[1], { $unset: { adminNote: '' } });
});

test('a bad order id is rejected', async () => {
  const r = await run('nope', { text: 'x' });
  assert.ok(r.error || r.success === false);
});
