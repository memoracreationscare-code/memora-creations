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
const webPush = require('../services/webPush');
const { requireAdmin } = require('../middleware/auth');

const pushService = require('../services/pushService');
const { getKeys, cleanUrl } = pushService;

/* Optional login: links a phone to the signed-in customer (so order updates reach it). */
async function whoIs(req) {
  try {
    const token = req.cookies && req.cookies.memora_user_token;
    if (!token) return null;
    const payload = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
    if (!payload || payload.type !== 'user') return null;
    const user = await require('../models').User.findById(payload.sub).select('_id isActive').lean();
    return user && user.isActive ? user._id : null;
  } catch (_) {
    return null;
  }
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

    const userId = await whoIs(req);
    const set = { userAgent: String(req.get('user-agent') || '').slice(0, 300) };

    if (userId) set.user = userId;

    await PushSubscription.updateOne(
      { endpoint },
      {
        $set: set,
        $setOnInsert: { endpoint, createdAt: new Date(), lastSeenAt: new Date(), role: 'customer' }
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

router.get('/latest', async (req, res) => {
  try {
    const m = await pushService.nextMessageFor(String(req.query.e || ''));
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

/* This phone becomes an admin phone (new orders + evening summary). */
router.post('/admin/subscribe', requireAdmin, async (req, res) => {
  try {
    const endpoint = req.body && req.body.subscription && req.body.subscription.endpoint;

    if (!webPush.isPushEndpoint(endpoint)) {
      return res.status(400).json({ success: false, message: 'Subscription sahi nahi hai.' });
    }

    await PushSubscription.updateOne(
      { endpoint },
      {
        $set: { role: 'admin', user: null },
        $setOnInsert: { endpoint, createdAt: new Date(), lastSeenAt: new Date() }
      },
      { upsert: true }
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Admin notification chalu nahi hua.' });
  }
});

router.get('/admin', requireAdmin, async (_req, res) => {
  try {
    const [subscribers, history] = await Promise.all([
      PushSubscription.countDocuments({ role: { $ne: 'admin' } }),
      PushMessage.find({ kind: 'broadcast' }).sort({ createdAt: -1 }).limit(20).lean()
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

    const result = await pushService.notify({
      kind: 'broadcast',
      title,
      body,
      url: req.body && req.body.url
    });

    res.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
      removed: result.removed,
      message: `${result.sent} logon ko notification bhej diya.`
    });
  } catch (error) {
    console.error('Push send error:', error);
    res.status(500).json({ success: false, message: 'Notification nahi bhej paye.' });
  }
});

module.exports = router;
module.exports.cleanUrl = cleanUrl;
