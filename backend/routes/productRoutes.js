
/*
=========================================
 MEMORA CREATIONS
 FAST PUBLIC PRODUCT ROUTES

 FEATURES:
 - Product listing cache: 10 seconds
 - Category cache: 60 seconds
 - Memory-limited cache
 - No cache for individual products
 - No caching for errors
 - Original API controllers preserved
=========================================
*/

'use strict';

const express = require('express');

const router = express.Router();

const controller = require(
  '../controllers/productController'
);

/* =====================================
   CACHE CONFIGURATION
===================================== */

const PRODUCT_CACHE_MS = 10 * 1000;
const CATEGORY_CACHE_MS = 60 * 1000;
const MAX_CACHE_ENTRIES = 100;

const responseCache = new Map();

/* =====================================
   CLEAN EXPIRED CACHE ENTRIES
===================================== */

function cleanExpiredEntries() {
  const now = Date.now();

  for (const [key, entry] of responseCache) {
    if (entry.expiresAt <= now) {
      responseCache.delete(key);
    }
  }
}

/* =====================================
   GET CACHED RESPONSE
===================================== */

function getCachedResponse(key) {
  const entry = responseCache.get(key);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return null;
  }

  return entry.data;
}

/* =====================================
   SAVE RESPONSE
===================================== */

function saveCachedResponse(key, data, ttl) {
  cleanExpiredEntries();

  if (responseCache.has(key)) {
    responseCache.delete(key);
  }

  while (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey =
      responseCache.keys().next().value;

    if (oldestKey === undefined) {
      break;
    }

    responseCache.delete(oldestKey);
  }

  responseCache.set(key, {
    data,
    expiresAt: Date.now() + ttl
  });
}

/* =====================================
   CACHE MIDDLEWARE

   Public GET routes only.
   Error responses are never cached.

   Browser/CDN caching is disabled
   to avoid shared stale responses.
===================================== */

function publicCache(ttl) {
  return function cacheMiddleware(req, res, next) {
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = req.originalUrl;

    res.setHeader(
      'Cache-Control',
      'no-store'
    );

    const cachedData =
      getCachedResponse(cacheKey);

    if (cachedData !== null) {
      res.setHeader(
        'X-Memora-Cache',
        'HIT'
      );

      return res.status(200).json(cachedData);
    }

    res.setHeader(
      'X-Memora-Cache',
      'MISS'
    );

    const originalJson =
      res.json.bind(res);

    res.json = function cachedJson(data) {
      if (
        res.statusCode === 200 &&
        data &&
        typeof data === 'object' &&
        data.success === true
      ) {
        saveCachedResponse(
          cacheKey,
          data,
          ttl
        );
      }

      return originalJson(data);
    };

    next();
  };
}

/* =====================================
   ALL PRODUCTS

   GET /api/products

   Preserves:
   - Search
   - Filters
   - Category filtering
   - Sort
   - Pagination
===================================== */

router.get(
  '/',
  publicCache(PRODUCT_CACHE_MS),
  controller.listProducts
);

/* =====================================
   CATEGORIES

   GET /api/products/categories
===================================== */

router.get(
  '/categories',
  publicCache(CATEGORY_CACHE_MS),
  controller.listCategories
);

/* =====================================
   SINGLE PRODUCT

   GET /api/products/:id

   Not cached:
   latest price and stock are fetched.
===================================== */

router.get(
  '/:id',
  controller.getProduct
);

/* =====================================
   EXPORT ROUTER
===================================== */

module.exports = router;
