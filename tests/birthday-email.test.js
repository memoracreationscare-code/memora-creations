'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const { sweepBirthdayEmails } = require('../backend/services/notificationSweeper');
const templates = require('../backend/utils/emailTemplates');

// 2026-11-21 10:00 IST  (04:30 UTC)
const NOON = new Date('2026-11-21T04:30:00Z');
const EARLY = new Date('2026-11-21T01:30:00Z'); // 07:00 IST

function make({ users = [], settings = {}, configured = true, failSend = false } = {}) {
  const log = [];
  const rows = users.map(u => ({ ...u }));
  return {
    log, rows,
    User: {
      find: q => {
        assert.strictEqual(q.birthday, '11-21');
        assert.strictEqual(q.isActive, true);
        const list = rows.filter(u => u.birthday === q.birthday && u.birthdayEmailYear !== 2026 && u.email);
        return { select: () => ({ limit: () => ({ lean: async () => list.map(u => ({ ...u })) }) }) };
      },
      updateOne: async (f, u) => {
        const row = rows.find(r => String(r._id) === String(f._id));
        if (u.$set) {
          if (row.birthdayEmailYear === u.$set.birthdayEmailYear) return { modifiedCount: 0 };
          row.birthdayEmailYear = u.$set.birthdayEmailYear;
          return { modifiedCount: 1 };
        }
        if (u.$unset) { delete row.birthdayEmailYear; return { modifiedCount: 1 }; }
        return { modifiedCount: 0 };
      }
    },
    settings: { peek: () => ({ emailNotificationsEnabled: true, birthdayEmailEnabled: true, ...settings }) },
    mail: {
      mailConfigured: () => configured,
      sendMail: async m => { if (failSend) throw new Error('smtp down'); log.push(m.to + '|' + m.subject); }
    },
    templates
  };
}

const rahul = { _id: 'u1', fullName: 'Rahul Kumar', email: 'rahul@example.com', birthday: '11-21' };

test('sends one Happy Birthday email on the birthday, never twice', async () => {
  const d = make({ users: [rahul] });
  assert.deepStrictEqual(await sweepBirthdayEmails(d, NOON), { sent: 1, failed: 0 });
  assert.deepStrictEqual(await sweepBirthdayEmails(d, NOON), { sent: 0, failed: 0 });
  assert.strictEqual(d.log.length, 1);
  assert.match(d.log[0], /rahul@example\.com\|Happy Birthday Rahul/);
  assert.strictEqual(d.rows[0].birthdayEmailYear, 2026);
});

test('waits until 9 AM India time', async () => {
  const d = make({ users: [rahul] });
  assert.deepStrictEqual(await sweepBirthdayEmails(d, EARLY), { sent: 0, failed: 0 });
});

test('does nothing when emails or the birthday option are off, or no mail service', async () => {
  for (const o of [{ settings: { emailNotificationsEnabled: false } }, { settings: { birthdayEmailEnabled: false } }, { configured: false }]) {
    const d = make({ users: [rahul], ...o });
    assert.deepStrictEqual(await sweepBirthdayEmails(d, NOON), { sent: 0, failed: 0 });
    assert.strictEqual(d.log.length, 0);
  }
});

test('a failed send is retried later the same day', async () => {
  const d = make({ users: [rahul], failSend: true });
  assert.deepStrictEqual(await sweepBirthdayEmails(d, NOON), { sent: 0, failed: 1 });
  assert.strictEqual(d.rows[0].birthdayEmailYear, undefined);
  d.mail.sendMail = async m => { d.log.push(m.to); };
  assert.deepStrictEqual(await sweepBirthdayEmails(d, NOON), { sent: 1, failed: 0 });
});

test('email text is safe and personal', () => {
  const m = templates.birthdayEmail({ fullName: '<b>Anita</b> Devi' });
  assert.ok(!m.html.includes('<b>Anita</b>'));
  assert.match(m.html, /Happy Birthday/);
  assert.match(m.subject, /Happy Birthday/);
});

test('the setting is wired end to end', () => {
  const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  assert.match(read('backend/services/settingsService.js'), /birthdayEmailEnabled: true/);
  assert.match(read('backend/models/SiteSettings.js'), /birthdayEmailEnabled: Boolean/);
  assert.match(read('backend/controllers/adminSettingsController.js'), /'birthdayEmailEnabled'/);
  assert.match(read('admin/js/settings.js'), /'birthdayEmailEnabled'/);
  assert.match(read('admin/settings.html'), /id="birthdayEmailEnabled"/);
  assert.match(read('backend/models/User.js'), /birthdayEmailYear/);
});
