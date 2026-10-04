const jwt = require('jsonwebtoken');
const { User, Admin } = require('../models');

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.COOKIE_SAMESITE || 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  };
}

function setAuthCookie(res, payload) {
  res.cookie(process.env.COOKIE_NAME || 'memora_token', signToken(payload), cookieOptions());
}

function clearAuthCookie(res) {
  res.clearCookie(process.env.COOKIE_NAME || 'memora_token', { ...cookieOptions(), maxAge: undefined });
}

async function requireUser(req, res, next) {
  try {
    const token = req.cookies[process.env.COOKIE_NAME || 'memora_token'];
    if (!token) return res.status(401).json({ success: false, message: 'Login required.' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.type !== 'user') return res.status(401).json({ success: false, message: 'Invalid session.' });
    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) return res.status(401).json({ success: false, message: 'Account is unavailable.' });
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Session expired. Please login again.' });
  }
}

async function requireAdmin(req, res, next) {
  try {
    const token = req.cookies[process.env.COOKIE_NAME || 'memora_token'];
    if (!token) return res.status(401).json({ success: false, message: 'Admin login required.' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.type !== 'admin') return res.status(403).json({ success: false, message: 'Admin access required.' });
    const admin = await Admin.findById(payload.sub);
    if (!admin || !admin.isActive) return res.status(403).json({ success: false, message: 'Admin account is unavailable.' });
    req.admin = admin;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Admin session expired.' });
  }
}

module.exports = { signToken, setAuthCookie, clearAuthCookie, requireUser, requireAdmin };
