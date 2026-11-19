'use strict';

/*
  Public product feeds for Google Merchant Center and Meta Catalog (Instagram / Facebook shop).
    GET /api/feed/products.xml
    GET /api/feed/products.csv
  Only active products; nothing private is included.
*/

const router = require('express').Router();
const { Product } = require('../models');
const feed = require('../services/productFeed');

async function load() {
  return Product.find({ isActive: true })
    .select('productId name description images category sellingPrice originalPrice stock')
    .sort({ createdAt: -1 })
    .limit(3000)
    .lean();
}

router.get('/products.xml', async (_req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=3600');
    res.type('application/xml').send(feed.toXml(await load()));
  } catch (err) {
    console.error('[Feed]', err.message);
    res.status(500).type('text/plain').send('Feed unavailable');
  }
});

router.get('/products.csv', async (_req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=3600');
    res.type('text/csv').send(feed.toCsv(await load()));
  } catch (err) {
    console.error('[Feed]', err.message);
    res.status(500).type('text/plain').send('Feed unavailable');
  }
});

module.exports = router;
