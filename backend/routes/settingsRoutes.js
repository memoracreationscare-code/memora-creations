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

module.exports = router;
