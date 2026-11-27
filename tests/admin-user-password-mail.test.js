'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const crypto = require('node:crypto');
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

test('link: random, only its hash is for storing, expires in 7 days', () => {
  const a = pm.newLink(); const b = pm.newLink();
  assert.notStrictEqual(a.token, b.token);
  assert.strictEqual(a.hash, crypto.createHash('sha256').update(a.token).digest('hex'));
  const days = (a.expiresAt - Date.now()) / 86400000;
  assert.ok(days > 6.9 && days <= 7);
});

test('email carries a set-password link and NEVER a password', async () => {
  sent = [];
  const l = pm.newLink();
  const r = await pm.sendResetLink(user, l.token);
  assert.strictEqual(r.sent, true);
  assert.strictEqual(r.to, 'a***@x.in', 'address is masked for the screen');
  assert.strictEqual(sent[0].to, 'asha@x.in');
  assert.ok(sent[0].html.includes('reset-password.html?token=' + l.token));
  assert.doesNotMatch(sent[0].html, /naya password:|Aapka naya password/i);
});

test('names are escaped in the email', () => {
  const m = pm.build(user, 'abc');
  assert.ok(!m.html.includes('Asha <b>'));
});

test('no email, no mail setup, or a provider error: false, never throws', async () => {
  sent = [];
  assert.deepStrictEqual(await pm.sendResetLink({ ...user, email: '' }, 't'), { sent: false, reason: 'NO_EMAIL' });
  configured = false;
  assert.deepStrictEqual(await pm.sendResetLink(user, 't'), { sent: false, reason: 'MAIL_NOT_SET_UP' });
  configured = true; fail = true;
  assert.deepStrictEqual(await pm.sendResetLink(user, 't'), { sent: false, reason: 'SEND_FAILED' });
  assert.strictEqual(sent.length, 0);
});

test('admin reset stores the link hash before saving, mails after saving, and never mails the password', () => {
  const src = fs.readFileSync('backend/controllers/adminController.js', 'utf8');
  const i = src.indexOf('const resetUserPassword');
  const fn = src.slice(i, i + 3500);
  assert.ok(fn.indexOf('passwordResetTokenHash = link.hash') < fn.indexOf('await user.save()'));
  assert.ok(fn.indexOf('await user.save()') < fn.indexOf('sendResetLink'));
  assert.doesNotMatch(fn, /sendResetLink\([^)]*password\b[^)]*\)/);
  const ui = fs.readFileSync('admin/js/users.js', 'utf8');
  assert.match(ui, /saved\.emailed/);
  assert.match(ui, /mailStatusHtml\(saved\)/, 'popup shows whether the mail went');
  assert.match(ui, /MAIL_NOT_SET_UP/);
});
