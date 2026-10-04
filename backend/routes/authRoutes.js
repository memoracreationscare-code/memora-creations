const router = require('express').Router();
const c = require('../controllers/authController');
const { requireUser } = require('../middleware/auth');
router.post('/register', c.register); router.post('/login', c.login); router.post('/logout', c.logout); router.get('/me', requireUser, c.me); router.post('/forgot-password', c.forgotPassword); router.post('/reset-password', c.resetPassword);
module.exports = router;
