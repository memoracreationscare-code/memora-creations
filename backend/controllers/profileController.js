const { User } = require('../models');
const { asyncHandler, error, ok } = require('../utils/http');
const { cleanString, validEmail, validMobile, validPin } = require('../utils/validation');

const getProfile = asyncHandler(async (req, res) => ok(res, { user: req.user }));
const updateProfile = asyncHandler(async (req, res) => {
  const fullName = cleanString(req.body.fullName, 100); const email = cleanString(req.body.email, 150) || undefined;
  if (fullName.length < 2 || !validEmail(email)) throw error(400, 'Invalid profile details.');
  if (email && email !== req.user.email && await User.findOne({ email, _id: { $ne: req.user._id } })) throw error(409, 'Email already in use.');
  req.user.fullName = fullName; req.user.email = email;
  if (req.body.birthday !== undefined) {
    const b = cleanString(req.body.birthday, 5);
    if (b && !/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(b)) throw error(400, 'Birthday sahi nahi hai.');
    req.user.birthday = b || undefined;
  }
  await req.user.save();
  return ok(res, { user: req.user });
});
const AVATAR_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const updateAvatar = asyncHandler(async (req, res) => {
  const avatar = typeof req.body.avatar === 'string' ? req.body.avatar.trim() : '';
  if (avatar && (avatar.length > 100000 || !AVATAR_PATTERN.test(avatar))) throw error(400, 'Invalid photo. Please choose a smaller JPG, PNG or WebP image.');
  req.user.avatar = avatar; await req.user.save();
  return ok(res, { avatar: req.user.avatar });
});
const addAddress = asyncHandler(async (req, res) => {
  const a = req.body; if (!cleanString(a.fullName, 100) || !validMobile(a.mobile) || !cleanString(a.addressLine, 300) || !validPin(a.pinCode)) throw error(400, 'Invalid address.');
  if (a.isDefault) req.user.addresses.forEach(x => { x.isDefault = false; });
  if (!req.user.addresses.length) a.isDefault = true;
  req.user.addresses.push({ label: cleanString(a.label, 40) || 'Address', fullName: cleanString(a.fullName, 100), mobile: cleanString(a.mobile, 20), addressLine: cleanString(a.addressLine, 300), pinCode: String(a.pinCode), city: cleanString(a.city, 80), state: cleanString(a.state, 80), isDefault: Boolean(a.isDefault) });
  await req.user.save(); return ok(res, { addresses: req.user.addresses }, 201);
});
const updateAddress = asyncHandler(async (req, res) => {
  const a = req.user.addresses.id(req.params.id); if (!a) throw error(404, 'Address not found.');
  const body = req.body; if (!cleanString(body.fullName, 100) || !validMobile(body.mobile) || !cleanString(body.addressLine, 300) || !validPin(body.pinCode)) throw error(400, 'Invalid address.');
  if (body.isDefault) req.user.addresses.forEach(x => { x.isDefault = false; });
  Object.assign(a, { label: cleanString(body.label, 40) || 'Address', fullName: cleanString(body.fullName, 100), mobile: cleanString(body.mobile, 20), addressLine: cleanString(body.addressLine, 300), pinCode: String(body.pinCode), city: cleanString(body.city, 80), state: cleanString(body.state, 80), isDefault: Boolean(body.isDefault) });
  await req.user.save(); return ok(res, { addresses: req.user.addresses });
});
const deleteAddress = asyncHandler(async (req, res) => {
  const a = req.user.addresses.id(req.params.id); if (!a) throw error(404, 'Address not found.');
  a.deleteOne(); await req.user.save(); return ok(res, { addresses: req.user.addresses });
});
/* "Khaas din": up to 5 dates (MM-DD) the shop reminds the customer about before the day. */
const MAX_DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const listDates = asyncHandler(async (req, res) => ok(res, { dates: (req.user.specialDates || []).map(d => ({ _id: d._id, name: d.name, occasion: d.occasion, date: d.date })) }));
const addDate = asyncHandler(async (req, res) => {
  const name = cleanString(req.body.name, 60);
  const occasion = ['Birthday', 'Anniversary', 'Other'].includes(req.body.occasion) ? req.body.occasion : 'Other';
  const m = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(String(req.body.date || ''));
  if (name.length < 2) throw error(400, 'Naam likhein (jaise: Maa).');
  if (!m || Number(m[2]) > MAX_DAYS_IN[Number(m[1]) - 1]) throw error(400, 'Tareekh sahi nahi hai.');
  const list = req.user.specialDates || [];
  if (list.length >= 5) throw error(400, 'Zyada se zyada 5 khaas din save ho sakte hain.');
  req.user.specialDates = [...list, { name, occasion, date: m[0] }];
  await req.user.save();
  return listDates(req, res);
});
const deleteDate = asyncHandler(async (req, res) => {
  const list = req.user.specialDates || [];
  if (!list.some(d => String(d._id) === String(req.params.id))) throw error(404, 'Ye din nahi mila.');
  req.user.specialDates = list.filter(d => String(d._id) !== String(req.params.id));
  await req.user.save();
  return listDates(req, res);
});
/* My offers: referral code + personal coupons that can still be used. */
const getOffers = asyncHandler(async (req, res) => {
  const settings = require('../services/settingsService').peek();
  const referral = require('../services/referralService');
  const { Coupon, Order } = require('../models');

  const [code, coupons, earlier] = await Promise.all([
    settings.referralEnabled ? referral.ensureReferralCode(req.user._id) : '',
    Coupon.find({
      allowedUser: req.user._id,
      isActive: true,
      usedCount: 0,
      expiresAt: { $gt: new Date() }
    }).sort({ expiresAt: 1 }).limit(10).lean(),
    Order.exists({
      user: req.user._id,
      orderStatus: { $ne: 'Cancelled' },
      paymentStatus: { $nin: ['FAILED', 'CANCELLED'] }
    })
  ]);

  return ok(res, {
    referral: {
      enabled: settings.referralEnabled === true,
      code,
      friendAmount: settings.referralFriendAmount,
      rewardAmount: settings.referralRewardAmount,
      minOrder: settings.referralMinOrder
    },
    welcome: {
      available: settings.welcomeEnabled === true && !earlier,
      code: referral.WELCOME_CODE,
      percent: settings.welcomePercent,
      maxDiscount: settings.welcomeMaxDiscount,
      minOrder: settings.welcomeMinOrder
    },
    coupons: coupons.map(c => ({
      code: c.code,
      description: c.description,
      value: c.discountValue,
      minOrder: c.minOrderAmount,
      expiresAt: c.expiresAt
    }))
  });
});

const getReferrals = asyncHandler(async (req, res) => {
  const data = await require('../services/referralService').overviewFor(req.user._id);

  return ok(res, data || { referredBy: null, stats: { joined: 0, ordered: 0, rewarded: 0, earned: 0 }, friends: [] });
});

module.exports = { listDates, addDate, deleteDate, getReferrals, getOffers, getProfile, updateProfile, updateAvatar, addAddress, updateAddress, deleteAddress };
