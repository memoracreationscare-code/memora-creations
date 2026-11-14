'use strict';

/*
  Customer photos for personalised products (e.g. photo frames).

  - Photos live in Cloudinary, NOT in MongoDB. The database keeps only a small
    link ({ url, publicId }) per photo.
  - Every photo sits in memora-creations/customer-photos/<userId>/ so an order
    can only use the customer's own uploads.
  - They are deleted automatically some days after delivery (setting
    customPhotoKeepDays) and never-used uploads are cleaned up daily.
*/

const FOLDER = 'memora-creations/customer-photos';
const MAX_NOTE = 300;
const MAX_PHOTOS_LIMIT = 10;
const CANCELLED_KEEP_DAYS = 7;
const ORPHAN_AFTER_HOURS = 72;

const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function userFolder(userId) {
  return `${FOLDER}/${userId}`;
}

function cloudName() {
  return process.env.CLOUDINARY_CLOUD_NAME || '';
}

function error(status, message) {
  const err = new Error(message);

  err.status = status;
  err.statusCode = status;
  return err;
}

function personalizationOf(product) {
  const p = (product && product.personalization) || {};

  return {
    enabled: p.enabled === true,
    label: String(p.label || '').trim(),
    maxPhotos: Math.min(MAX_PHOTOS_LIMIT, Math.max(1, Math.floor(Number(p.maxPhotos) || 1)))
  };
}

function cleanNote(raw) {
  return String(raw == null ? '' : raw).replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, MAX_NOTE);
}

/*
  Accepts what the browser sends and returns only photos that really are this
  customer's Cloudinary uploads. Anything else is rejected.
*/
function cleanPhotos(raw, userId) {
  if (raw === undefined || raw === null || raw === '') return [];

  if (!Array.isArray(raw)) throw error(400, 'Invalid photos.');

  if (raw.length > MAX_PHOTOS_LIMIT) throw error(400, 'Too many photos.');

  const folder = userFolder(userId);
  const seen = new Set();
  const out = [];

  for (const item of raw) {
    const url = String((item && item.url) || '');
    const publicId = String((item && item.publicId) || '');

    const urlOk = cloudName() &&
      new RegExp('^https://res\\.cloudinary\\.com/' + esc(cloudName()) + '/image/upload/[^?#\\s]+$').test(url) &&
      url.includes('/' + folder + '/');

    if (!urlOk || !publicId.startsWith(folder + '/') || publicId.includes('..') || !url.includes(publicId)) {
      throw error(400, 'Photo is not valid. Please upload it again.');
    }

    if (seen.has(publicId)) continue;

    seen.add(publicId);
    out.push({ url, publicId });
  }

  return out;
}

/* Returns { photos, note } to store, or throws a clear message. */
function checkCustomization(product, rawPhotos, rawNote, userId) {
  const cfg = personalizationOf(product);

  if (!cfg.enabled) return { photos: [], note: '' };

  const photos = cleanPhotos(rawPhotos, userId);

  if (photos.length < 1) {
    throw error(400, `${product.name}: pehle apni photo upload karein (zaroori hai).`);
  }

  if (photos.length > cfg.maxPhotos) {
    throw error(400, `${product.name}: maximum ${cfg.maxPhotos} photo upload kar sakte hain.`);
  }

  return { photos, note: cleanNote(rawNote) };
}

/* ---------- Cloudinary clean-up ---------- */

function cloudinaryClient() {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return null;
  }

  const cloudinary = require('cloudinary').v2;

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });

  return cloudinary;
}

async function destroyPhotos(publicIds, client = cloudinaryClient()) {
  const ids = [...new Set(publicIds)].filter(id => typeof id === 'string' && id.startsWith(FOLDER + '/'));

  if (!ids.length) return 0;

  if (!client) throw error(503, 'Cloudinary is not configured.');

  let deleted = 0;

  for (let i = 0; i < ids.length; i += 90) {
    const res = await client.api.delete_resources(ids.slice(i, i + 90), { resource_type: 'image', type: 'upload' });
    const map = (res && res.deleted) || {};

    deleted += Object.values(map).filter(v => v === 'deleted' || v === 'not_found').length;
  }

  return deleted;
}

function photoIdsOfOrder(order) {
  const ids = [];

  for (const item of order.items || []) {
    for (const p of item.customPhotos || []) ids.push(p.publicId);
  }

  return ids;
}

/* Delete one order's photos now (also used by the admin button). */
async function deleteOrderPhotos(order, deps = {}) {
  const Order = deps.Order || require('../models').Order;
  const ids = photoIdsOfOrder(order);

  if (!ids.length) return 0;

  const n = await destroyPhotos(ids, deps.client);

  await Order.updateOne({ _id: order._id }, { $set: { customPhotosDeletedAt: new Date() } });

  return n;
}

function keepDays(settings) {
  const n = Math.floor(Number(settings && settings.customPhotoKeepDays));

  return Number.isFinite(n) ? Math.min(365, Math.max(3, n)) : 30;
}

/*
  Daily job: (1) photos of delivered / cancelled orders that are old enough,
  (2) photos that were uploaded but never used in any order.
*/
async function sweepCustomPhotos(deps = {}, now = new Date()) {
  const models = deps.models || require('../models');
  const { Order, Cart } = models;
  const settings = deps.settings || require('./settingsService').peek();
  const client = deps.client === undefined ? cloudinaryClient() : deps.client;
  const result = { orders: 0, photos: 0, orphans: 0 };

  if (!client) return result;

  const day = 24 * 60 * 60 * 1000;
  const deliveredBefore = new Date(now.getTime() - keepDays(settings) * day);
  const cancelledBefore = new Date(now.getTime() - CANCELLED_KEEP_DAYS * day);

  const orders = await Order.find({
    'items.customPhotos.0': { $exists: true },
    customPhotosDeletedAt: null,
    $or: [
      { orderStatus: 'Delivered', statusHistory: { $elemMatch: { status: 'Delivered', changedAt: { $lt: deliveredBefore } } } },
      { orderStatus: 'Cancelled', statusHistory: { $elemMatch: { status: 'Cancelled', changedAt: { $lt: cancelledBefore } } } }
    ]
  }).limit(50);

  for (const order of orders) {
    try {
      result.photos += await deleteOrderPhotos(order, { Order, client });
      result.orders += 1;
    } catch (err) {
      console.warn('[Customer photos]', err.message);
    }
  }

  // Uploaded but never used (customer left the page): remove after 72 hours.
  const list = await client.api.resources({ type: 'upload', prefix: FOLDER + '/', max_results: 200 });
  const old = (list.resources || []).filter(r =>
    now.getTime() - new Date(r.created_at).getTime() > ORPHAN_AFTER_HOURS * 60 * 60 * 1000
  );

  const unused = [];

  for (const r of old) {
    const inOrder = await Order.exists({ 'items.customPhotos.publicId': r.public_id });
    const inCart = inOrder ? null : await Cart.exists({ 'items.customPhotos.publicId': r.public_id });

    if (!inOrder && !inCart) unused.push(r.public_id);
  }

  if (unused.length) result.orphans = await destroyPhotos(unused, client);

  return result;
}

let lastRun = 0;

/* Called every few minutes by the notification sweeper; really runs once a day. */
async function maybeSweep() {
  if (Date.now() - lastRun < 23 * 60 * 60 * 1000) return null;

  lastRun = Date.now();

  const r = await sweepCustomPhotos();

  if (r.orders || r.orphans) console.log('[Customer photos]', JSON.stringify(r));

  return r;
}

module.exports = {
  FOLDER,
  MAX_NOTE,
  MAX_PHOTOS_LIMIT,
  CANCELLED_KEEP_DAYS,
  personalizationOf,
  cleanNote,
  cleanPhotos,
  checkCustomization,
  userFolder,
  cloudinaryClient,
  destroyPhotos,
  deleteOrderPhotos,
  photoIdsOfOrder,
  keepDays,
  sweepCustomPhotos,
  maybeSweep
};
