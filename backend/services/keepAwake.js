/*
  KEEP AWAKE WHILE PEOPLE ARE ON THE SITE

  Render's free plan puts the server to sleep after ~15 minutes without
  any request, and waking it takes 30-50 seconds.

  - Every real visit is noted (markActivity). The website also sends one
    tiny "/api/health?visit=1" request the moment a page opens, so the
    server starts waking before the customer clicks anything.
  - While there was a visit in the last KEEP_AWAKE_MINUTES (default 30),
    the server pings its own public address every 10 minutes so it
    cannot fall asleep in the middle of shopping.
  - When nobody has visited for that long, it stops pinging and Render
    may sleep. It cannot be "instantly" awake from a full sleep - no
    free host can - but the visit ping above starts the wake-up first.

  Needs RENDER_EXTERNAL_URL (Render sets it automatically) or
  KEEP_AWAKE_URL. Turn off with KEEP_AWAKE=off.
*/

const PING_EVERY_MS = 10 * 60 * 1000;

let lastVisit = 0;

function isVisit(req) {
  const path = String(req.path || req.url || '').split('?')[0];

  if (path !== '/api/health') return true;

  return String((req.query && req.query.visit) || '') === '1';
}

function markActivity(req, _res, next) {
  try {
    if (isVisit(req)) lastVisit = Date.now();
  } catch (_) {
    /* never block a request */
  }

  next();
}

function baseUrl(env = process.env) {
  const raw = env.KEEP_AWAKE_URL || env.RENDER_EXTERNAL_URL || '';

  return String(raw).replace(/\/+$/, '');
}

function shouldPing(now = Date.now(), env = process.env) {
  const minutes = Number(env.KEEP_AWAKE_MINUTES) || 30;

  return lastVisit > 0 && now - lastVisit < minutes * 60 * 1000;
}

function start({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const url = baseUrl(env);

  if (String(env.KEEP_AWAKE || '').toLowerCase() === 'off') return null;
  if (!url || typeof fetchImpl !== 'function') return null;

  const timer = setInterval(() => {
    if (!shouldPing(Date.now(), env)) return;

    Promise.resolve(fetchImpl(`${url}/api/health`)).catch(() => {});
  }, PING_EVERY_MS);

  if (timer.unref) timer.unref();

  return timer;
}

function _reset(value = 0) {
  lastVisit = value;
}

module.exports = { markActivity, start, shouldPing, baseUrl, isVisit, _reset };
