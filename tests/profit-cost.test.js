'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('cost price is hidden from normal queries (cannot leak into public APIs)', () => {
  const model = read('backend/models/Product.js');
  assert.match(model, /costPrice:\s*\{[^}]*select:\s*false/s);
  // only the admin product list asks for it
  const users = fs.readdirSync(path.join(__dirname, '..', 'backend'), { recursive: true })
    .filter(f => String(f).endsWith('.js'))
    .filter(f => /\+costPrice/.test(read('backend/' + f)));
  assert.deepStrictEqual(users.map(String), [path.join('controllers', 'adminController.js')]);
});

test('admin form sends and loads the cost price; blank clears it', () => {
  assert.match(read('admin/products.html'), /id="costPrice"/);
  assert.match(read('admin/js/products.js'), /costPrice:\s*\n\s*\$\('#costPrice'\)\.value/);
  assert.match(read('backend/controllers/adminController.js'), /cleanCost\(body\.costPrice\)/);
});
