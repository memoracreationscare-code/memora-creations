'use strict';

/*
  POST /api/products/:id/notify-me   { email }
  Public. Customer asks to be emailed when an out-of-stock product is back.
  Answers the same way whether or not the email was already waiting.
*/

const EMAIL = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;

async function notifyMe(req, res, deps = {}) {
  const mongoose = deps.mongoose || require('mongoose');
  const models = deps.models || require('../models');

  const id = String(req.params.id || '');
  const email = String((req.body || {}).email || '').trim().toLowerCase().slice(0, 120);

  if (!EMAIL.test(email)) {
    return res.status(400).json({ success: false, message: 'Sahi email address daalein.' });
  }

  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ success: false, message: 'Product nahi mila.' });
  }

  const product = await models.Product.findOne({ _id: id, isActive: true }).select('stock').lean();

  if (!product) return res.status(404).json({ success: false, message: 'Product nahi mila.' });

  if (Number(product.stock) > 0) {
    return res.json({ success: true, inStock: true, message: 'Ye product abhi stock me hai, aap order kar sakte hain.' });
  }

  await models.StockAlert.updateOne(
    { product: id, email },
    { $setOnInsert: { product: id, email, notifiedAt: null } },
    { upsert: true }
  );

  return res.json({ success: true, message: 'Done! Stock aate hi hum aapko email karenge.' });
}

module.exports = { notifyMe };
