'use strict';

/*
  Builds sitemap.xml: the fixed pages + one address for every product that
  is live on the website. Run by the "Update sitemap" GitHub workflow every
  day. It can also be run by hand:  node scripts/build-sitemap.js
*/

const fs = require('fs');
const path = require('path');

const SITE = 'https://memoracreationscare-code.github.io/memora-creations/frontend';
const API = process.env.API_BASE || 'https://memora-creations.onrender.com/api';

const PAGES = [
  ['index.html', '1.0'], ['products.html', '0.9'], ['about.html', '0.5'], ['contact.html', '0.5'],
  ['shipping-policy.html', '0.3'], ['return-refund-policy.html', '0.3'], ['privacy-policy.html', '0.3'], ['terms.html', '0.3']
];

const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));

function buildSitemap(products, today) {
  const url = (loc, priority, lastmod) =>
    `  <url>\n    <loc>${esc(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <priority>${priority}</priority>\n  </url>`;

  const fixed = PAGES.map(([file, p]) => url(`${SITE}/${file}`, p, today));
  const items = products
    .filter(p => p && p._id)
    .map(p => url(`${SITE}/product.html?id=${encodeURIComponent(p._id)}`, '0.8', String(p.updatedAt || today).slice(0, 10)));

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...fixed, ...items].join('\n')}\n</urlset>\n`;
}

async function fetchAllProducts(fetchJson, limit = 48) {
  const all = [];

  for (let page = 1; page <= 50; page++) {
    const data = await fetchJson(`${API}/products?page=${page}&limit=${limit}`);
    const batch = data.products || [];

    all.push(...batch);

    if (!batch.length || page >= (data.pagination?.pages || 1)) break;
  }

  return all;
}

async function main() {
  const fetchJson = async url => {
    // the free server may be asleep: allow a long wait and a few tries
    for (let attempt = 1; ; attempt++) {
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(90000) });

        if (!r.ok) throw new Error('HTTP ' + r.status);

        return await r.json();
      } catch (err) {
        if (attempt >= 3) throw err;
      }
    }
  };

  const products = await fetchAllProducts(fetchJson);

  // never replace a good sitemap with an empty one
  if (!products.length) throw new Error('No products returned; sitemap left unchanged.');

  const xml = buildSitemap(products, new Date().toISOString().slice(0, 10));

  fs.writeFileSync(path.join(__dirname, '..', 'sitemap.xml'), xml);
  console.log(`sitemap.xml written with ${products.length} products.`);
}

if (require.main === module) {
  main().catch(err => { console.error(err.message); process.exit(1); });
}

module.exports = { buildSitemap, fetchAllProducts };
