'use strict';

/*
  PUBLIC
  GET  /api/push/key          website's public push key
  POST /api/push/subscribe    save a phone/browser that allowed notifications
  POST /api/push/unsubscribe  remove it
  GET  /api/push/latest       last message (read by the service worker)

  ADMIN
  GET  /api/push/admin        subscriber count + last messages
  POST /api/push/admin/send   send a notification to everyone
*/

const router = require('express').Router();
const PushSubscription = require('../models/PushSubscription');
const PushMessage = require('../models/PushMessage');
const PushConfig = require('../models/PushConfig');
const webPush = require('../services/webPush');
const { requireAdmin } = require('../middleware/auth');

const SUBJECT = process.env.VAPID_SUBJECT || 'https://memoracreationscare.in';

let keyCache = null;

async function getKeys() {
  if (keyCache) return keyCache;

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
  if (/^https:\/\/(www\.)?memoracreationscare\.in(\/|$)/i.test(v)) {
    return v.slice(0, 300);
  }
  return '/frontend/index.html';
}

router.get('/key', async (_req, res) => {
  try {
    const keys = await getKeys();
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({ success: true, publicKey: keys.publicKey });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Push abhi available nahi hai.' });
  }
});

router.post('/subscribe', async (req, res) => {
  try {
    const sub = req.body && req.body.subscription;
    const endpoint = sub && sub.endpoint;

    if (!webPush.isPushEndpoint(endpoint)) {
      return res.status(400).json({ success: false, message: 'Subscription sahi nahi hai.' });
    }

    await PushSubscription.updateOne(
      { endpoint },
      {
        $set: { userAgent: String(req.get('user-agent') || '').slice(0, 300) },
        $setOnInsert: { endpoint, createdAt: new Date() }
      },
      { upsert: true }
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Notification chalu nahi ho paya.' });
  }
});

router.post('/unsubscribe', async (req, res) => {
  try {
    const endpoint = req.body && req.body.endpoint;
    if (webPush.isPushEndpoint(endpoint)) {
      await PushSubscription.deleteOne({ endpoint });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

router.get('/latest', async (_req, res) => {
  try {
    const m = await PushMessage.findOne().sort({ createdAt: -1 }).lean();
    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      message: m
        ? { title: m.title, body: m.body, url: m.url, at: m.createdAt }
        : null
    });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

router.get('/admin', requireAdmin, async (_req, res) => {
  try {
    const [subscribers, history] = await Promise.all([
      PushSubscription.countDocuments({}),
      PushMessage.find().sort({ createdAt: -1 }).limit(20).lean()
    ]);

    res.json({ success: true, subscribers, history });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Data load nahi hua.' });
  }
});

router.post('/admin/send', requireAdmin, async (req, res) => {
  try {
    const title = String((req.body && req.body.title) || '').trim().slice(0, 80);
    const body = String((req.body && req.body.body) || '').trim().slice(0, 240);

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: 'Title aur message likhna zaroori hai.'
      });
    }

    const keys = await getKeys();
    const subs = await PushSubscription.find({}).select('endpoint').lean();

    const message = await PushMessage.create({
      title,
      body,
      url: cleanUrl(req.body && req.body.url)
    });

    const result = await webPush.sendToAll(subs, keys, SUBJECT);

    if (result.gone.length) {
      await PushSubscription.deleteMany({ endpoint: { $in: result.gone } });
    }

    message.sent = result.sent;
    message.failed = result.failed;
    await message.save();

    res.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
      removed: result.gone.length,
      message: `${result.sent} logon ko notification bhej diya.`
    });
  } catch (error) {
    console.error('Push send error:', error);
    res.status(500).json({ success: false, message: 'Notification nahi bhej paye.' });
  }
});

module.exports = router;
module.exports.cleanUrl = cleanUrl;
