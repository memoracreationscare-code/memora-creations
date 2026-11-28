'use strict';

/*
  GET /api/settings        public: safe values the website needs
  (admin edits them through /api/admin/settings)
*/

const router = require('express').Router();
const settings = require('../services/settingsService');

function publicView(s) {
  return {
    storeOpen: s.storeOpen,
    storeClosedMessage: s.storeClosedMessage,
    whatsapp: s.whatsapp,
    phone: s.phone,
    email: s.email,
    address: s.address,
    instagram: s.instagram,
    facebook: s.facebook,
    youtube: s.youtube,
    deliveryCharge: s.deliveryCharge,
    freeDeliveryAbove: s.freeDeliveryAbove,
    freeDeliveryBar: s.freeDeliveryBar,
    codEnabled: s.codEnabled,
    codMaxAmount: Number(s.codMaxAmount) || 0,
    returnsEnabled: s.returnsEnabled,
    returnWindowDays: s.returnWindowDays,
    welcomeEnabled: s.welcomeEnabled,
    welcomePercent: s.welcomePercent,
    welcomeMaxDiscount: s.welcomeMaxDiscount,
    welcomeMinOrder: s.welcomeMinOrder,
    referralEnabled: s.referralEnabled,
    referralFriendAmount: s.referralFriendAmount,
    referralRewardAmount: s.referralRewardAmount,
    chatEnabled: s.chatEnabled === true,
    shareEnabled: s.shareEnabled !== false,
    waOrderEnabled: s.waOrderEnabled !== false,
    waOrderText: s.waOrderText || '',
    recentViewedEnabled: s.recentViewedEnabled !== false,
    trustBadgesEnabled: s.trustBadgesEnabled !== false,
    badgesEnabled: s.badgesEnabled !== false,
    shuffleProducts: s.shuffleProducts !== false,
    installAppEnabled: s.installAppEnabled !== false,
    waUpdatesEnabled: s.waUpdatesEnabled === true,
    faqText: s.faqText || '',
    heroKicker: s.heroKicker,
    heroLine1: s.heroLine1,
    heroHighlight: s.heroHighlight,
    heroDescription: s.heroDescription,
    heroButtonText: s.heroButtonText
  };
}

router.get('/', async (_req, res) => {
  const current = await settings.load();

  res.set('Cache-Control', 'no-store');

  return res.json({ success: true, ok: true, settings: publicView(current) });
});

// Text the owner wrote for a policy / about page (plain text; empty = use the page's own text)
router.get('/pages/:slug', async (req, res) => {
  try {
    const { PAGES } = require('../controllers/adminPagesController');
    const slug = String(req.params.slug || '');

    if (!Object.prototype.hasOwnProperty.call(PAGES, slug)) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    const doc = await require('../models/PageContent').findOne({ slug }).select('body').lean();

    res.set('Cache-Control', 'public, max-age=60');

    return res.json({ success: true, body: (doc && doc.body) || '' });
  } catch (_) {
    return res.json({ success: true, body: '' }); // never break a public page
  }
});

module.exports = router;
