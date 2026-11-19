'use strict';

const test = require('node:test');
const assert = require('node:assert');
const ws = require('../backend/services/weeklySummary');

// Monday 2026-11-16, 10:00 IST = 04:30 UTC
const MON = new Date('2026-11-16T04:30:00Z');
const TUE = new Date('2026-11-17T04:30:00Z');
const MON_EARLY = new Date('2026-11-16T01:00:00Z'); // 06:30 IST

function deps({ enabled = true, last = null, mailOk = true, to = 'shop@x.in' } = {}) {
  const calls = { mails: [], updates: [] };
  const rows = [{ orders: 3, revenue: 1500, cod: 1, delivered: 2 }];

  return {
    calls,
    models: {
      Order: {
        aggregate: async stages => (stages.some(s => s.$unwind) ? [{ _id: 'Gold <Lamp>', qty: 2, sales: 998 }] : rows)
      },
      Product: { find: () => ({ select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [{ name: 'Vase', stock: 2 }] }) }) }) }) },
      User: { countDocuments: async () => 4 }
    },
    SiteSettings: {
      findOne: () => ({ select: () => ({ lean: async () => (last ? { lastWeeklySummaryAt: last } : null) }) }),
      updateOne: async (...a) => { calls.updates.push(a); }
    },
    settings: { peek: () => ({ weeklySummaryEnabled: enabled, email: to }) },
    mail: { mailConfigured: () => mailOk, sendMail: async m => { calls.mails.push(m); } }
  };
}

test('IST helpers', () => {
  assert.deepStrictEqual(ws.istParts(MON), { day: 1, hour: 10 });
  assert.strictEqual(ws.startOfTodayIST(MON).toISOString(), '2026-11-15T18:30:00.000Z');
  assert.strictEqual(ws.change(150, 100), '+50%');
  assert.strictEqual(ws.change(50, 100), '-50%');
  assert.strictEqual(ws.change(5, 0), 'naya');
});

test('sends once on Monday morning with real numbers', async () => {
  const d = deps();
  const r = await ws.sweepWeeklySummary(d, MON);

  assert.strictEqual(r.sent, true);
  assert.strictEqual(d.calls.mails.length, 1);
  assert.match(d.calls.mails[0].subject, /3 orders/);
  assert.ok(d.calls.mails[0].html.includes('Gold &lt;Lamp&gt;'));
  assert.ok(d.calls.mails[0].html.includes('Vase: 2 bacha'));
  assert.strictEqual(d.calls.updates.length, 1);
});

test('does not send when off, not Monday, too early, already sent, or no mail', async () => {
  for (const [opts, when] of [
    [{ enabled: false }, MON], [{}, TUE], [{}, MON_EARLY],
    [{ last: new Date(MON - 2 * 864e5) }, MON], [{ mailOk: false }, MON], [{ to: '' }, MON]
  ]) {
    const d = deps(opts);
    const prev = process.env.ADMIN_ALERT_EMAIL;
    delete process.env.ADMIN_ALERT_EMAIL;
    const r = await ws.sweepWeeklySummary(d, when);
    if (prev) process.env.ADMIN_ALERT_EMAIL = prev;
    assert.strictEqual(r.sent, false);
    assert.strictEqual(d.calls.mails.length, 0);
  }
});

test('a failed send gives the slot back so the next run retries', async () => {
  const d = deps();
  d.mail.sendMail = async () => { throw new Error('smtp down'); };

  await assert.rejects(ws.sweepWeeklySummary(d, MON), /smtp down/);
  assert.strictEqual(d.calls.updates.length, 2);
  assert.strictEqual(d.calls.updates[1][1].$set.lastWeeklySummaryAt, null);
});
