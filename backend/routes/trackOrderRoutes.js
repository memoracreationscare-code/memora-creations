'use strict';

const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { trackOrder } = require('../controllers/trackOrderController');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Bahut zyada koshish. 15 minute baad dobara try karein.' }
});

router.post('/', limiter, (req, res) =>
  trackOrder(req, res).catch(err => {
    console.error('[Track order]', err.message);
    res.status(500).json({ success: false, message: 'Abhi tracking available nahi hai. Thodi der baad try karein.' });
  })
);

module.exports = router;
