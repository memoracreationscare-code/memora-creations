'use strict';

/*
  Blocks "NoSQL injection".

  A request such as  ?category[$ne]=x  or a JSON body containing
  {"mobile":{"$gt":""}}  would otherwise reach MongoDB as a query
  operator. Any key that starts with "$" or contains "." is removed
  from the body, query string and URL parameters before the
  controllers see it.
*/

function clean(value, depth = 0) {
  if (!value || typeof value !== 'object' || depth > 10) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach(item => clean(item, depth + 1));
    return;
  }

  Object.keys(value).forEach(key => {
    if (key.startsWith('$') || key.includes('.')) {
      delete value[key];
      return;
    }

    clean(value[key], depth + 1);
  });
}

function sanitizeRequest(req, _res, next) {
  clean(req.body);
  clean(req.query);
  clean(req.params);
  next();
}

module.exports = { sanitizeRequest, clean };
