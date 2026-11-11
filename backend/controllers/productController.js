const { Product, Category } = require('../models');
const { asyncHandler, error, ok } = require('../utils/http');
const { cleanString } = require('../utils/validation');
const { fuzzyMatch, words } = require('../utils/fuzzySearch');

/* name + keywords of live products, kept for a minute, for "did you mean" search */
let vocabCache = { at: 0, list: [] };

async function searchVocabulary() {
  if (Date.now() - vocabCache.at < 60000) return vocabCache.list;

  const list = await Product.find({ isActive: true }).select('name keywords').limit(3000).lean();

  vocabCache = { at: Date.now(), list };

  return list;
}

function slugify(s) {
  return cleanString(s, 180)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function serialize(p) {
  return {
    ...p,
    discountPercent: p.discountPercent ?? 0
  };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


/* =========================
   ALL PRODUCTS
========================= */

const listProducts = asyncHandler(async (req, res) => {

  const {
    q = '',
    category = '',
    sort = 'newest',
    page = 1,
    limit = 24,
    featured,
    newArrival,
    bestSeller,
    offers,
    minPrice,
    maxPrice,
    inStock
  } = req.query;

  if (typeof q !== 'string' || typeof category !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Invalid search.'
    });
  }

  const filter = {
    isActive: true
  };


  /* CATEGORY */

  if (category) {
    filter.category = category;
  }


  /* PRODUCT TYPES */

  if (featured === 'true') {
    filter.isFeatured = true;
  }

  if (newArrival === 'true') {
    filter.isNewArrival = true;
  }

  if (bestSeller === 'true') {
    filter.isBestSeller = true;
  }

  if (offers === 'true') {
    filter.discountPercent = {
      $gt: 0
    };
  }


  /* PRICE + STOCK FILTERS */

  const low = Number(minPrice);
  const high = Number(maxPrice);

  if (minPrice !== undefined && minPrice !== '' && Number.isFinite(low) && low >= 0) {
    filter.sellingPrice = { ...(filter.sellingPrice || {}), $gte: low };
  }

  if (maxPrice !== undefined && maxPrice !== '' && Number.isFinite(high) && high > 0) {
    filter.sellingPrice = { ...(filter.sellingPrice || {}), $lte: high };
  }

  if (inStock === 'true') {
    filter.stock = { $gt: 0 };
  }


  /* SEARCH: every typed word must appear in name, description, keywords or category */

  const searchText = q.trim().slice(0, 100);
  const typedWords = words(searchText).slice(0, 6);
  let fuzzySuggestion = '';

  const wordFilter = async list => {
    const ands = [];

    for (const word of list) {
      const re = { $regex: escapeRegex(word), $options: 'i' };
      const cats = await Category.find({ name: re }).select('_id').limit(10).lean();
      const or = [{ name: re }, { description: re }, { keywords: re }];

      if (cats.length) or.push({ category: { $in: cats.map(c => c._id) } });

      ands.push({ $or: or });
    }

    return ands;
  };

  if (typedWords.length) {
    filter.$and = await wordFilter(typedWords);
  }


  /* SORT */

  const sortMap = {

    low: {
      sellingPrice: 1
    },

    high: {
      sellingPrice: -1
    },

    newest: {
      createdAt: -1
    },

    popular: {
      isBestSeller: -1,
      createdAt: -1
    }

  };


  /* PAGINATION */

  const pageNum =
    Math.max(
      1,
      Number(page) || 1
    );

  const pageSize =
    Math.min(
      48,
      Math.max(
        1,
        Number(limit) || 24
      )
    );


  const run = f => Promise.all([

    Product
      .find(f)
      .populate('category', 'name slug')
      .sort(sortMap[sort] || sortMap.newest)
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize)
      .lean(),

    Product.countDocuments(f)

  ]);

  let [products, total] = await run(filter);

  /* Nothing found: try again forgiving small spelling mistakes ("candel", "lamb"). */
  if (total === 0 && typedWords.length && pageNum === 1) {
    try {
      const { ids, suggestion } = fuzzyMatch(await searchVocabulary(), searchText);

      if (ids.length) {
        const { $and, ...rest } = filter;

        [products, total] = await run({ ...rest, _id: { $in: ids } });
        fuzzySuggestion = total ? suggestion : '';
      }
    } catch (err) {
      console.warn('[Search] fuzzy fallback skipped:', err.message);
    }
  }


  return ok(res, {

    ...(fuzzySuggestion ? { didYouMean: fuzzySuggestion } : {}),

    products:
      products.map(serialize),

    pagination: {

      page: pageNum,

      limit: pageSize,

      total,

      pages:
        Math.ceil(
          total / pageSize
        )

    }

  });

});


/* =========================
   SINGLE PRODUCT
========================= */

const getProduct =
  asyncHandler(async (req, res) => {

    const key =
      String(req.params.id || '');

    const ors = [
      {
        productId: key
      },
      {
        slug: key
      }
    ];

    if (
      require('mongoose')
        .isValidObjectId(key)
    ) {
      ors.unshift({
        _id: key
      });
    }

    const product =
      await Product
        .findOne({
          $or: ors,
          isActive: true
        })
        .populate(
          'category',
          'name slug'
        )
        .lean();


    if (!product) {
      throw error(
        404,
        'Product not found.'
      );
    }


    return ok(res, {
      product:
        serialize(product)
    });

  });


/* =========================
   CATEGORIES
========================= */

const listCategories =
  asyncHandler(
    async (_req, res) => {

      const categories =
        await Category
          .find({
            isActive: true
          })
          .sort({
            name: 1
          })
          .lean();

      return ok(res, {
        categories
      });

    }
  );


module.exports = {
  listProducts,
  getProduct,
  listCategories,
  slugify,
  serialize
};
