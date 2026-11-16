'use strict';

/*
  Sends phone notifications to one customer, to the admin phones, or to
  everyone. Every message is stored (PushMessage); a push itself is empty
  and the service worker asks /api/push/latest?e=<its endpoint> for the
  next message that phone has not seen yet.
*/

const webPush = require('./webPush');

const SUBJECT = process.env.VAPID_SUBJECT || 'https://memoracreationscare.in';

let keyCache = null;

async function getKeys() {
  if (keyCache) return keyCache;

  const PushConfig = require('../models/PushConfig');

  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY_PEM) {
    keyCache = {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKeyPem: process.env.VAPID_PRIVATE_KEY_PEM.replace(/\\n/g, '\n')
    };
    return keyCache;
  }

  let doc = await PushConfig.findOne({ key: 'vapid' }).lean();

  if (!doc) {
    try {
      doc = (
        await PushConfig.create({ key: 'vapid', ...webPush.generateKeys() })
      ).toObject();
    } catch (_) {
      doc = await PushConfig.findOne({ key: 'vapid' }).lean();
    }
  }

  keyCache = { publicKey: doc.publicKey, privateKeyPem: doc.privateKeyPem };
  return keyCache;
}

function cleanUrl(value) {
  const v = String(value || '').trim();
  if (!v) return '/frontend/index.html';
  if (v.startsWith('/') && !v.startsWith('//')) return v.slice(0, 300);
  if (/^https:\/\/(www\.)?memoracreationscare\.in(\/|$)/i.test(v)) return v.slice(0, 300);
  return '/frontend/index.html';
}

/*
  kind: 'broadcast' (all customers) | 'user' (one customer) | 'admin'
  Returns { sent, failed, removed, subscribers }.
*/
async function notify({ kind, userId = null, title, body, url }, deps = {}) {
  const PushSubscription = deps.PushSubscription || require('../models/PushSubscription');
  const PushMessage = deps.PushMessage || require('../models/PushMessage');
  const send = deps.sendToAll || webPush.sendToAll;

  const filter =
    kind === 'user'
      ? { user: userId, role: 'customer' }
      : kind === 'admin'
        ? { role: 'admin' }
        : { role: { $ne: 'admin' } };

  const subs = await PushSubscription.find(filter).select('endpoint').lean();

  const message = await PushMessage.create({
    kind,
    user: kind === 'user' ? userId : null,
    title: String(title).slice(0, 80),
    body: String(body).slice(0, 240),
    url: cleanUrl(url)
  });

  if (!subs.length) return { sent: 0, failed: 0, removed: 0, subscribers: 0, messageId: message._id };

  const keys = await (deps.getKeys || getKeys)();
  const result = await send(subs, keys, SUBJECT);

  if (result.gone.length) {
    await PushSubscription.deleteMany({ endpoint: { $in: result.gone } });
  }

  message.sent = result.sent;
  message.failed = result.failed;
  await message.save();

  return {
    sent: result.sent,
    failed: result.failed,
    removed: result.gone.length,
    subscribers: subs.length,
    messageId: message._id
  };
}

/* The next unseen message for one phone (used by /api/push/latest). */
async function nextMessageFor(endpoint, deps = {}) {
  const PushSubscription = deps.PushSubscription || require('../models/PushSubscription');
  const PushMessage = deps.PushMessage || require('../models/PushMessage');

  const sub = endpoint ? await PushSubscription.findOne({ endpoint }).lean() : null;

  if (!sub) {
    const m = await PushMessage.findOne({ kind: 'broadcast' }).sort({ createdAt: -1 }).lean();
    return m || null;
  }

  const scope = [{ kind: 'broadcast' }];

  if (sub.role === 'admin') scope.push({ kind: 'admin' });
  else if (sub.user) scope.push({ kind: 'user', user: sub.user });

  const since = sub.lastSeenAt || sub.createdAt || new Date(0);

  const m = await PushMessage.findOne({
    createdAt: { $gt: since },
    $or: scope
  }).sort({ createdAt: 1 }).lean();

  if (m) {
    await PushSubscription.updateOne({ endpoint }, { $set: { lastSeenAt: m.createdAt } });
  }

  return m || null;
}

module.exports = { notify, nextMessageFor, getKeys, cleanUrl };
