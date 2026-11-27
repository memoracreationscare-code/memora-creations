'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const Module = require('node:module');

let sent = [];
let configured = true;
let fail = false;
const orig = Module._load;
Module._load = function (request, ...rest) {
  if (request === './mailService') {
    return {
      mailConfigured: () => configured,
      sendMail: async m => { if (fail) throw new Error('provider down'); sent.push(m); return true; }
    };
  }
  return orig.call(this, request, ...rest);
};
test.after(() => { Module._load = orig; });

const pm = require('../backend/services/passwordMail');
const user = { fullName: 'Asha <b>', mobile: '9876543210', email: 'asha@x.in' };

test('customer with an email gets the new password, only at their own address', async () => {
  sent = [];
  assert.strictEqual(await pm.sendNewPassword(user, 'NewPass#123'), true);
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].to, 'asha@x.in');
  assert.ok(sent[0].html.includes('NewPass#123'));
  assert.ok(sent[0].html.includes('Profile'), 'tells them to change it');
});

test('names and passwords are escaped in the email', () => {
  const m = pm.build(user, '<script>x</script>');
  assert.ok(!m.html.includes('<script>x</script>'));
  assert.ok(!m.html.includes('Asha <b>'));
});

test('no email, no mail setup, or a provider error: returns false, never throws', async () => {
  sent = [];
  assert.strictEqual(await pm.sendNewPassword({ ...user, email: '' }, 'x1234567'), false);
  configured = false;
  assert.strictEqual(await pm.sendNewPassword(user, 'x1234567'), false);
  configured = true; fail = true;
  assert.strictEqual(await pm.sendNewPassword(user, 'x1234567'), false);
  assert.strictEqual(sent.length, 0);
});

test('admin reset sends the mail after saving, and the screen tells the owner', () => {
  const src = fs.readFileSync('backend/controllers/adminController.js', 'utf8');
  const fn = src.slice(src.indexOf('const resetUserPassword'), src.indexOf('const resetUserPassword') + 3000);
  assert.ok(fn.indexOf('await user.save()') < fn.indexOf('sendNewPassword'), 'saved first');
  assert.match(fs.readFileSync('admin/js/users.js', 'utf8'), /saved\.emailed/);
});
