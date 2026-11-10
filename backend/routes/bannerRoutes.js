'use strict';

const router = require('express').Router();

router.get('/', require('../controllers/bannerController').publicBanners);

module.exports = router;
