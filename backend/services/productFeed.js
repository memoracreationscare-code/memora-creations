'use strict';

/*
  Product feed for Google Merchant Center and Meta (Instagram / Facebook) Catalog.
  Public, read-only: GET /api/feed/products.xml and /api/feed/products.csv
*/

const SITE = 'https://memoracreationscare.in/frontend';

const esc = v => String(v ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const money = n => `${Number(n).toFixed(2)} INR`;

function plain(text, max) {
  return String(text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

// One feed row per sellable product; products without an image or price are skipped.
function toItem(p, site = SITE) {
  const image = p.images && p.images[0] && p.images[0].url;
  const selling = Number(p.sellingPrice);
  const original = Number(p.originalPrice);

  if (!image || !(selling > 0) || !p.name) return null;

  const onSale = original > selling;

  return {
    id: String(p.productId || p._id),
    title: plain(p.name, 150),
    description: plain(p.description, 4900) || plain(p.name, 150),
    link: `${site}/product.html?id=${encodeURIComponent(p._id)}`,
    image,
    extraImages: (p.images || []).slice(1, 6).map(i => i.url).filter(Boolean),
    availability: Number(p.stock) > 0 ? 'in stock' : 'out of stock',
    price: money(onSale ? original : selling),
    salePrice: onSale ? money(selling) : '',
    brand: 'Memora Creations',
    category: p.category ? plain(p.category, 100) : '',
    condition: 'new'
  };
}

function toXml(products, site = SITE) {
  const items = products.map(p => toItem(p, site)).filter(Boolean);

  const body = items.map(i => `    <item>
      <g:id>${esc(i.id)}</g:id>
      <title>${esc(i.title)}</title>
      <description>${esc(i.description)}</description>
      <link>${esc(i.link)}</link>
      <g:image_link>${esc(i.image)}</g:image_link>
${i.extraImages.map(u => `      <g:additional_image_link>${esc(u)}</g:additional_image_link>`).join('\n')}${i.extraImages.length ? '\n' : ''}      <g:availability>${i.availability}</g:availability>
      <g:price>${esc(i.price)}</g:price>${i.salePrice ? `\n      <g:sale_price>${esc(i.salePrice)}</g:sale_price>` : ''}
      <g:brand>${esc(i.brand)}</g:brand>
      <g:condition>${i.condition}</g:condition>${i.category ? `\n      <g:product_type>${esc(i.category)}</g:product_type>` : ''}
      <g:identifier_exists>no</g:identifier_exists>
    </item>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Memora Creations</title>
    <link>${esc(site.replace(/\/frontend$/, ''))}</link>
    <description>Home decor and gifts from Memora Creations</description>
${body}
  </channel>
</rss>
`;
}

const csvCell = v => {
  let s = String(v ?? '');

  // Spreadsheet formula guard.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;

  return `"${s.replace(/"/g, '""')}"`;
};

function toCsv(products, site = SITE) {
  const head = ['id', 'title', 'description', 'availability', 'condition', 'price', 'sale_price', 'link', 'image_link', 'brand'];
  const rows = products.map(p => toItem(p, site)).filter(Boolean).map(i =>
    [i.id, i.title, i.description, i.availability, i.condition, i.price, i.salePrice, i.link, i.image, i.brand].map(csvCell).join(',')
  );

  return [head.join(','), ...rows].join('\n') + '\n';
}

module.exports = { toItem, toXml, toCsv, esc, SITE };
