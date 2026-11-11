'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { fuzzyMatch, distance } = require('../backend/utils/fuzzySearch');

const catalogue = [
  { _id: 1, name: 'Wooden Wall Hanging', keywords: ['decor', 'boho'] },
  { _id: 2, name: 'Scented Candle Set', keywords: ['gift', 'diwali'] },
  { _id: 3, name: 'Table Lamp', keywords: ['light'] },
  { _id: 4, name: 'Photo Frame', keywords: ['memory'] }
];

test('distance counts single-letter slips', () => {
  assert.strictEqual(distance('candle', 'candel'), 1);
  assert.strictEqual(distance('lamp', 'lamb'), 1);
  assert.strictEqual(distance('lamp', 'lamp'), 0);
});

test('forgives small spelling mistakes', () => {
  assert.deepStrictEqual(fuzzyMatch(catalogue, 'candel').ids, [2]);
  assert.deepStrictEqual(fuzzyMatch(catalogue, 'lamb').ids, [3]);
  assert.deepStrictEqual(fuzzyMatch(catalogue, 'woden wal hanging').ids, [1]);
  assert.strictEqual(fuzzyMatch(catalogue, 'candel').suggestion, 'candle');
});

test('prefix typing works (can -> candle) and every word has to match', () => {
  assert.deepStrictEqual(fuzzyMatch(catalogue, 'can').ids, [2]);
  assert.deepStrictEqual(fuzzyMatch(catalogue, 'candle lamp').ids, []);
});

test('nonsense and very short words do not match everything', () => {
  assert.deepStrictEqual(fuzzyMatch(catalogue, 'zzzzzz').ids, []);
  assert.deepStrictEqual(fuzzyMatch(catalogue, 'xy').ids, []);
  assert.deepStrictEqual(fuzzyMatch(catalogue, '').ids, []);
});
