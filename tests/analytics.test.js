'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const ID = 'G-L3RZK67Z7K';

test('GA4 tag is on customer pages once, in <head>, and never in admin or on the reset-password page', () => {
  for (const f of fs.readdirSync('frontend').filter(n => n.endsWith('.html'))) {
    const s = fs.readFileSync('frontend/' + f, 'utf8');
    const n = s.split(ID + '"').length - 1 + (s.split("'" + ID + "'").length - 1);
    if (f === 'reset-password.html') { assert.ok(!s.includes(ID), f); continue; }
    assert.ok(s.indexOf(ID) > -1 && s.indexOf(ID) < s.indexOf('</head>'), f + ' missing in head');
    assert.equal(s.split('googletagmanager.com/gtag/js').length - 1, 1, f + ' loads gtag more than once');
    assert.ok(n >= 2);
  }
  for (const f of fs.readdirSync('admin').filter(n => n.endsWith('.html'))) {
    assert.ok(!fs.readFileSync('admin/' + f, 'utf8').includes(ID), 'admin ' + f);
  }
});
