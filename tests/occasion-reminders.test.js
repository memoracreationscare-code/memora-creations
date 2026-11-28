'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');

const { sweepOccasionReminders } = require('../backend/services/notificationSweeper');
const templates = require('../backend/utils/emailTemplates');

// 2026-11-21 10:00 IST. 7 days later = 11-28.
const NOW = new Date('2026-11-21T04:30:00Z');
const EARLY = new Date('2026-11-21T01:30:00Z');

function make({ settings = {}, configured = true, failSend = false } = {}) {
  const log = [];
  const user = { _id: 'u1', fullName: 'Rahul Kumar', email: 'r@x.in', specialDates: [
    { _id: 'd1', name: 'Maa <b>', occasion: 'Birthday', date: '11-28' },
    { _id: 'd2', name: 'Papa', occasion: 'Birthday', date: '03-02' }
  ] };
  return {
    log, user,
    User: {
      find: q => {
        assert.strictEqual(q.specialDates.$elemMatch.date, '11-28');
        assert.strictEqual(q.specialDates.$elemMatch.remindYear.$ne, 2026);
        return { select: () => ({ limit: () => ({ lean: async () => [JSON.parse(JSON.stringify(user))] }) }) };
      },
      updateOne: async (f, u) => {
        const d = user.specialDates.find(x => x._id === (f.specialDates?.$elemMatch?._id || f['specialDates._id']));
        if (u.$set) { if (d.remindYear === 2026) return { modifiedCount: 0 }; d.remindYear = 2026; return { modifiedCount: 1 }; }
        delete d.remindYear; return { modifiedCount: 1 };
      }
    },
    settings: { peek: () => ({ emailNotificationsEnabled: true, occasionReminderEnabled: true, occasionReminderDays: 7, ...settings }) },
    mail: { mailConfigured: () => configured, sendMail: async m => { if (failSend) throw new Error('x'); log.push(m); } },
    templates
  };
}

test('sends one reminder 7 days before, escaped, and never twice', async () => {
  const d = make();
  assert.deepStrictEqual(await sweepOccasionReminders(d, NOW), { sent: 1, failed: 0 });
  assert.match(d.log[0].subject, /7 din baad/);
  assert.ok(!d.log[0].html.includes('Maa <b>'));
  assert.deepStrictEqual(await sweepOccasionReminders(d, NOW), { sent: 0, failed: 0 });
  assert.strictEqual(d.log.length, 1);
});

test('failed send is retried; switches and 9 AM rule respected', async () => {
  const f = make({ failSend: true });
  assert.deepStrictEqual(await sweepOccasionReminders(f, NOW), { sent: 0, failed: 1 });
  assert.strictEqual(f.user.specialDates[0].remindYear, undefined);
  for (const [d, t] of [[make({ settings: { occasionReminderEnabled: false } }), NOW], [make({ settings: { emailNotificationsEnabled: false } }), NOW], [make({ configured: false }), NOW], [make(), EARLY]]) {
    assert.deepStrictEqual(await sweepOccasionReminders(d, t), { sent: 0, failed: 0 });
  }
});

test('wiring: routes, settings, profile card', () => {
  assert.match(fs.readFileSync('backend/routes/profileRoutes.js', 'utf8'), /'\/dates'/);
  for (const f of ['backend/services/settingsService.js', 'backend/controllers/adminSettingsController.js', 'backend/routes/settingsRoutes.js', 'admin/js/settings.js', 'admin/settings.html']) assert.ok(fs.readFileSync(f, 'utf8').includes('occasionReminderEnabled'), f);
  assert.ok(fs.readFileSync('frontend/profile.html', 'utf8').includes('special-dates.js'));
  assert.ok(!/innerHTML/.test(fs.readFileSync('frontend/js/special-dates.js', 'utf8')));
});
