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

/* Optional login: if the customer is signed in, the chat can see THEIR orders. Anyone else stays anonymous. */
async function optionalUser(req, _res, next) {
  try {
    const token = req.cookies && req.cookies.memora_user_token;

    if (token) {
      const payload = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);

      if (payload && payload.type === 'user') {
        const user = await require('../models').User.findById(payload.sub).select('_id isActive').lean();

        if (user && user.isActive) req.chatUserId = user._id;
      }
    }
  } catch (_) { /* not logged in */ }

  next();
}

router.post('/', limiter, optionalUser, (req, res) =>
  chat(req, res).catch(err => {
    console.error('[Chat]', err.message);
    res.status(500).json({ success: false, message: 'Abhi chat available nahi hai. WhatsApp par likhein.' });
  })
);

module.exports = router;
