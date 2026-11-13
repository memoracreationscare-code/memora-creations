'use strict';

const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { chat } = require('../controllers/chatController');

const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 25,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Bahut zyada sawal. Thodi der baad try karein ya WhatsApp par likhein.' }
});

router.post('/', limiter, (req, res) =>
  chat(req, res).catch(err => {
    console.error('[Chat]', err.message);
    res.status(500).json({ success: false, message: 'Abhi chat available nahi hai. WhatsApp par likhein.' });
  })
);

module.exports = router;
