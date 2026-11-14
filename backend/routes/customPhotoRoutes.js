'use strict';

const express = require('express');
const multer = require('multer');

const { requireUser } = require('../middleware/auth');
const { detectImageType } = require('../utils/imageType');
const photos = require('../services/customPhotoService');

const router = express.Router();

const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const MAX_BYTES = 8 * 1024 * 1024;
const HOURLY_LIMIT = 40;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!Object.values(MIME).includes(file.mimetype)) {
      const err = new Error('Sirf JPG, PNG ya WebP photo upload karein.');

      err.statusCode = 400;
      return cb(err);
    }

    cb(null, true);
  }
});

// small per-customer limit so nobody can fill the storage
const usage = new Map();

function allowed(userId) {
  const now = Date.now();
  const rec = usage.get(userId);

  if (!rec || now - rec.start > 60 * 60 * 1000) {
    usage.set(userId, { start: now, count: 1 });
    return true;
  }

  rec.count += 1;
  return rec.count <= HOURLY_LIMIT;
}

function uploadToCloudinary(client, buffer, folder) {
  return new Promise((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        overwrite: false,
        // keep the picture sharp for printing but not huge
        transformation: [{ width: 3000, height: 3000, crop: 'limit', quality: 'auto:best' }]
      },
      (err, result) => {
        if (err || !result || !result.secure_url) return reject(err || new Error('Upload failed.'));

        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );

    stream.end(buffer);
  });
}

/* POST /api/custom-photos   (form field "photo") */
router.post('/', requireUser, upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'Please select a photo.' });
    }

    const type = detectImageType(req.file.buffer);

    if (!type || MIME[type] !== req.file.mimetype) {
      return res.status(400).json({ success: false, message: 'Ye photo valid nahi hai. JPG, PNG ya WebP use karein.' });
    }

    const userId = String(req.user._id);

    if (!allowed(userId)) {
      return res.status(429).json({ success: false, message: 'Bahut zyada photos upload ho gaye. Thodi der baad try karein.' });
    }

    const client = photos.cloudinaryClient();

    if (!client) {
      return res.status(503).json({ success: false, message: 'Photo upload abhi available nahi hai.' });
    }

    const photo = await uploadToCloudinary(client, req.file.buffer, photos.userFolder(userId));

    return res.status(201).json({ success: true, message: 'Photo upload ho gayi.', photo });
  } catch (err) {
    if (err && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: 'Photo 8 MB se chhoti honi chahiye.' });
    }

    return next(err);
  }
});

module.exports = router;
