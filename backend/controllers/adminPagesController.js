'use strict';

/*
  GET /api/admin/pages          which pages the owner has rewritten
  GET /api/admin/pages/:slug    the saved text of one page
  PUT /api/admin/pages/:slug    { body }  (empty = go back to the built-in text)

  The text is shown on the website as plain text (never as HTML).
*/

const { asyncHandler, error, ok } = require('../utils/http');

const PAGES = {
  'shipping-policy': 'Shipping & Delivery',
  'return-refund-policy': 'Return & Refund Policy',
  'privacy-policy': 'Privacy Policy',
  terms: 'Terms & Conditions',
  about: 'About Us'
};

const MAX = 20000;

const model = () => require('../models/PageContent');

const slugOf = req => {
  const slug = String(req.params.slug || '');

  if (!Object.prototype.hasOwnProperty.call(PAGES, slug)) throw error(404, 'Ye page nahi mila.');

  return slug;
};

const list = asyncHandler(async (_req, res) => {
  const docs = await model().find({}).select('slug body updatedAt').lean();
  const byslug = new Map(docs.map(d => [d.slug, d]));

  return ok(res, {
    pages: Object.entries(PAGES).map(([slug, title]) => ({
      slug,
      title,
      custom: Boolean(byslug.get(slug) && byslug.get(slug).body),
      updatedAt: byslug.get(slug) ? byslug.get(slug).updatedAt : null
    }))
  });
});

const get = asyncHandler(async (req, res) => {
  const slug = slugOf(req);
  const doc = await model().findOne({ slug }).lean();

  return ok(res, { slug, title: PAGES[slug], body: (doc && doc.body) || '' });
});

const put = asyncHandler(async (req, res) => {
  const slug = slugOf(req);
  const raw = (req.body || {}).body;

  if (raw !== undefined && typeof raw !== 'string') throw error(400, 'Text sahi nahi hai.');

  const body = String(raw || '').replace(/\r\n/g, '\n').replace(/\0/g, '').trim();

  if (body.length > MAX) throw error(400, `Text bahut lamba hai (${MAX} akshar tak).`);

  await model().findOneAndUpdate({ slug }, { $set: { body } }, { upsert: true });

  return ok(res, {
    slug,
    custom: Boolean(body),
    message: body ? 'Save ho gaya. Page par naya text dikhne lagega.' : 'Purana (built-in) text wapas laga diya.'
  });
});

module.exports = { list, get, put, PAGES };
