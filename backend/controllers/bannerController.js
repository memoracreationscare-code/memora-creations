'use strict';

/*
  Homepage banner slider.
    GET    /api/banners              public: active banners
    GET    /api/admin/banners        all banners
    POST   /api/admin/banners        add
    PUT    /api/admin/banners/:id    change
    DELETE /api/admin/banners/:id    remove
*/

const mongoose = require('mongoose');
const Banner = require('../models/Banner');
const { asyncHandler, error, ok } = require('../utils/http');

const isImage = v => /^https:\/\/[^\s]+$/i.test(v || '');
// Links may point inside the shop or to an https page.
const isLink = v => !v || /^(https:\/\/[^\s]+|\/(?:memora-creations\/)?(?:frontend|admin)\/[^\s]*|products\.html[^\s]*|[a-z-]+\.html[^\s]*)$/i.test(v);

function clean(body, partial = false) {
  const out = {};
  const text = (key, max) => {
    if (body[key] !== undefined) out[key] = String(body[key]).trim().slice(0, max);
  };

  text('title', 80);
  text('subtitle', 160);
  text('buttonText', 30);
  text('link', 300);

  if (body.imageUrl !== undefined || !partial) {
    if (!isImage(body.imageUrl)) throw error(400, 'Please upload a banner image.');
    out.imageUrl = String(body.imageUrl).trim();
  }

  if (body.mobileImageUrl !== undefined) {
    if (body.mobileImageUrl && !isImage(body.mobileImageUrl)) throw error(400, 'Mobile image is not valid.');
    out.mobileImageUrl = String(body.mobileImageUrl || '').trim();
  }

  if (out.link !== undefined && !isLink(out.link)) {
    throw error(400, 'Link must start with https:// or be a page of this shop (for example products.html).');
  }

  if (body.sortOrder !== undefined) {
    const n = Number(body.sortOrder);
    if (!Number.isFinite(n) || n < -1000 || n > 1000) throw error(400, 'Order must be a number.');
    out.sortOrder = Math.round(n);
  }

  if (body.active !== undefined) out.active = body.active === true;

  for (const key of ['startsAt', 'endsAt']) {
    if (body[key] === undefined) continue;
    if (!body[key]) { out[key] = null; continue; }
    const d = new Date(body[key]);
    if (Number.isNaN(d.getTime())) throw error(400, 'Date is not valid.');
    out[key] = d;
  }

  return out;
}

const publicBanners = asyncHandler(async (_req, res) => {
  const now = new Date();

  const banners = await Banner.find({
    active: true,
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $exists: false } }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $exists: false } }, { endsAt: { $gte: now } }] }
    ]
  })
    .sort({ sortOrder: 1, createdAt: -1 })
    .limit(8)
    .lean();

  res.set('Cache-Control', 'public, max-age=60');

  return ok(res, {
    banners: banners.map(b => ({
      id: String(b._id), imageUrl: b.imageUrl, mobileImageUrl: b.mobileImageUrl || '',
      title: b.title, subtitle: b.subtitle, buttonText: b.buttonText, link: b.link
    }))
  });
});

const listBanners = asyncHandler(async (_req, res) => {
  const banners = await Banner.find().sort({ sortOrder: 1, createdAt: -1 }).limit(100).lean();

  return ok(res, { banners });
});

const createBanner = asyncHandler(async (req, res) => {
  const count = await Banner.countDocuments();

  if (count >= 30) throw error(400, 'Too many banners. Delete old ones first.');

  const banner = await Banner.create(clean(req.body || {}));

  return ok(res, { banner }, 201);
});

const updateBanner = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw error(400, 'Invalid banner.');

  const banner = await Banner.findByIdAndUpdate(
    req.params.id, { $set: clean(req.body || {}, true) }, { new: true, runValidators: true }
  );

  if (!banner) throw error(404, 'Banner not found.');

  return ok(res, { banner });
});

const deleteBanner = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw error(400, 'Invalid banner.');

  await Banner.findByIdAndDelete(req.params.id);

  return ok(res, { deleted: true });
});

module.exports = { publicBanners, listBanners, createBanner, updateBanner, deleteBanner, clean };
