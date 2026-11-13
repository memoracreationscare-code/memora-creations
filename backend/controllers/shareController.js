'use strict';

/*
  GET /api/products/:id/share

  A small page for sharing a product on WhatsApp / Facebook / etc.
  Those apps read the title, price and photo from the page's meta tags to
  build the preview card (the normal product page fills them with JavaScript,
  which sharing apps do not run). People who open the link are sent straight
  to the real product page.
*/

const mongoose = require('mongoose');
const { Product } = require('../models');

const SITE = (process.env.FRONTEND_URL || 'https://memoracreationscare.in/frontend').replace(/\/+$/, '');

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function sharePage(product, siteUrl = SITE) {
  const target = `${siteUrl}/product.html?id=${encodeURIComponent(product._id)}`;
  const title = `${product.name} - Memora Creations`;
  const price = `Rs. ${Number(product.sellingPrice).toLocaleString('en-IN')}`;
  const description = `${price}${product.originalPrice > product.sellingPrice ? ` (MRP Rs. ${Number(product.originalPrice).toLocaleString('en-IN')})` : ''} - ${String(product.description || '').replace(/\s+/g, ' ').slice(0, 140)}`;
  const image = product.images?.[0]?.url || '';

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="Memora Creations">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(target)}">
${image ? `<meta property="og:image" content="${esc(image)}">\n<meta name="twitter:image" content="${esc(image)}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=${esc(target)}">
<link rel="canonical" href="${esc(target)}">
</head><body>
<p>Opening <a href="${esc(target)}">${esc(product.name)}</a>...</p>
<script>location.replace(${JSON.stringify(target)});</script>
</body></html>`;
}

const share = async (req, res, next) => {
  try {
    const key = String(req.params.id || '');
    const query = mongoose.isValidObjectId(key) ? { _id: key } : { slug: key };
    const product = await Product.findOne({ ...query, isActive: true }).select('name description sellingPrice originalPrice images').lean();

    if (!product) return res.redirect(302, SITE + '/products.html');

    res.set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' });

    return res.send(sharePage(product));
  } catch (err) {
    return next(err);
  }
};

module.exports = { share, sharePage };
