'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const root = path.join(__dirname, '..', 'backend');
const stub = (rel, exports) => {
  const file = require.resolve(path.join(root, rel));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
};

const users = [];
const coupons = [];
const orders = [];

const q = rows => {
  const p = Promise.resolve(rows);
  p.select = () => p; p.sort = () => p; p.limit = () => p; p.lean = () => p;
  return p;
};

stub('models/index.js', {
  User: {
    findById: id => q(users.find(u => String(u._id) === String(id)) || null),
    find: f => q(users.filter(u => {
      if (f.referredBy && f.referredBy.$exists) return !!u.referredBy;
      if (f.referredBy) return String(u.referredBy) === String(f.referredBy);
      if (f._id && f._id.$in) return f._id.$in.map(String).includes(String(u._id));
      return true;
    })),
    countDocuments: async f => users.filter(u => (f.referralRewarded ? u.referralRewarded === true : !!u.referredBy)).length
  },
  Order: { aggregate: async () => orders },
  Coupon: {
    find: () => q(coupons),
    countDocuments: async () => coupons.length
  }
});

const svc = require(path.join(root, 'services/referralService.js'));

test('names and numbers shown to other customers are masked', () => {
  assert.strictEqual(svc.maskName('Rahul Kumar Singh'), 'Rahul S.');
  assert.strictEqual(svc.maskName('Asha'), 'Asha');
  assert.strictEqual(svc.maskName(''), 'Customer');
  assert.strictEqual(svc.maskMobile('9794511901'), '97XXXXXX01');
});

test('referral status follows the friend: joined, ordered, delivered, rewarded', () => {
  assert.strictEqual(svc.statusOf({}, undefined), 'JOINED');
  assert.strictEqual(svc.statusOf({}, { placed: 1, delivered: 0 }), 'ORDERED');
  assert.strictEqual(svc.statusOf({}, { placed: 1, delivered: 1 }), 'DELIVERED');
  assert.strictEqual(svc.statusOf({ referralRewarded: true }, { placed: 1, delivered: 1 }), 'REWARDED');
});

test('customer history: who referred me, whom I referred, with masked friends', async () => {
  users.length = 0; coupons.length = 0; orders.length = 0;
  users.push(
    { _id: 'me', fullName: 'Meera Jain', mobile: '9000000001', referralCode: 'ME1234', referredBy: 'boss', referredAt: new Date(), referralFriendCode: 'MCGIFT1' },
    { _id: 'boss', fullName: 'Priya Sharma' },
    { _id: 'f1', fullName: 'Rahul Kumar', mobile: '9794511901', referredBy: 'me', createdAt: new Date(), referralRewarded: true, referralRewardCode: 'MCREW1' },
    { _id: 'f2', fullName: 'Asha Devi', mobile: '9876543210', referredBy: 'me', createdAt: new Date(), referralRewarded: false }
  );
  coupons.push({ code: 'MCREW1', discountValue: 50, usedCount: 0, expiresAt: new Date(Date.now() + 1e9) },
    { code: 'MCGIFT1', discountValue: 50, usedCount: 1, expiresAt: new Date(Date.now() + 1e9) });
  orders.push({ _id: 'f1', placed: 1, delivered: 1 }, { _id: 'f2', placed: 1, delivered: 0 });

  const d = await svc.overviewFor('me');

  assert.strictEqual(d.referredBy.name, 'Priya S.');
  assert.strictEqual(d.referredBy.gift.used, true);
  assert.deepStrictEqual(d.stats, { joined: 2, ordered: 2, rewarded: 1, earned: 50 });
  assert.deepStrictEqual(d.friends.map(f => [f.name, f.status]), [['Rahul K.', 'REWARDED'], ['Asha D.', 'ORDERED']]);
  assert.strictEqual(d.friends[0].mobile, '97XXXXXX01');
  assert.strictEqual(d.friends[0].reward.code, 'MCREW1');
  assert.ok(!JSON.stringify(d).includes('9794511901'));
});

test('admin history shows full details and totals', async () => {
  const d = await svc.adminOverview({});
  assert.strictEqual(d.stats.referred, 3);
  const row = d.rows.find(r => r.friend.mobile === '9794511901');
  assert.strictEqual(row.referrer.name, 'Meera Jain');
  assert.strictEqual(row.referrer.code, 'ME1234');
  assert.strictEqual(row.status, 'REWARDED');
  assert.strictEqual(d.topReferrers[0].name, 'Meera Jain');
  assert.ok(d.topReferrers.length >= 1);
  const s = await svc.adminOverview({ search: 'asha' });
  assert.strictEqual(s.rows.length, 1);
});

test('a failed reward gives the claim back so it is retried, never lost', async () => {
  const calls = [];
  const deps = {
    models: {
      User: {
        find: () => ({ select: () => ({ limit: () => ({ lean: async () => [{ _id: 'f1', referredBy: 'r1' }] }) }) }),
        updateOne: async (f, u) => { calls.push(u); return { modifiedCount: 1 }; }
      },
      Order: { exists: async () => true }
    },
    createCoupon: async () => { throw new Error('db down'); }
  };

  await assert.rejects(svc.rewardReferrers(deps, { referralEnabled: true, referralRewardAmount: 50, referralMinOrder: 0 }), /db down/);
  assert.strictEqual(calls.length, 2);
  assert.strictEqual(calls[1].$set.referralRewarded, false);
});

test('reward is stored against the friend with the coupon code', async () => {
  const calls = [];
  const deps = {
    models: {
      User: {
        find: () => ({ select: () => ({ limit: () => ({ lean: async () => [{ _id: 'f1', referredBy: 'r1' }] }) }) }),
        updateOne: async (f, u) => { calls.push(u); return { modifiedCount: 1 }; }
      },
      Order: { exists: async () => true }
    },
    createCoupon: async () => ({ code: 'MCXYZ' })
  };

  const r = await svc.rewardReferrers(deps, { referralEnabled: true, referralRewardAmount: 50, referralMinOrder: 0 });
  assert.strictEqual(r.rewarded, 1);
  assert.strictEqual(calls[1].$set.referralRewardCode, 'MCXYZ');
});
