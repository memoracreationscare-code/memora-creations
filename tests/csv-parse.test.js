'use strict';

const test = require('node:test');
const assert = require('node:assert');

global.window = {};
require('../admin/js/csv-parse.js');
const parse = global.window.mcParseCsv;

test('CSV with quotes, commas, new lines and Windows line ends', () => {
  const rows = parse('name,description\n"Lamp, big","say ""hi""\nline2"\r\nB,c\r\n\r\n');
  assert.deepStrictEqual(rows, [['name', 'description'], ['Lamp, big', 'say "hi"\nline2'], ['B', 'c']]);
});

test('a BOM at the start (Excel) is ignored and blank lines are skipped', () => {
  assert.deepStrictEqual(parse('﻿a,b\n\n1,2'), [['a', 'b'], ['1', '2']]);
});
