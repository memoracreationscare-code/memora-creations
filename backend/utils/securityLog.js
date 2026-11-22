'use strict';

/*
  Records suspicious activity so the owner can see it in the admin
  "Activity" page (and in the Render logs):

    LOGIN_FAILED, ADMIN_LOGIN_FAILED, ADMIN_OTP_FAILED,
    RATE_LIMITED, BLOCKED_ORIGIN

  Never stores passwords, tokens or request bodies - only the event, the
  path, the IP and (for logins) the mobile/email that was tried. The same
  event from the same IP is written at most once every 5 minutes so an
  attacker cannot fill the database.
*/

const WINDOW_MS = 5 * 60 * 1000;
const MAX_KEYS = 2000;
const seen = new Map();

function throttled(key, now) {
  const last = seen.get(key);

  if (last && now - last < WINDOW_MS) return true;

  if (seen.size >= MAX_KEYS) {
    for (const [k, t] of seen) if (now - t >= WINDOW_MS) seen.delete(k);
    if (seen.size >= MAX_KEYS) seen.clear();
  }

  seen.set(key, now);
  return false;
}

function mask(value) {
  const s = String(value || '').trim().slice(0, 80);

  if (s.length <= 4) return s ? '***' : '';

  return s.slice(0, 2) + '***' + s.slice(-2);
}

function logSecurity(event, req, detail, deps = {}) {
  try {
    const now = (deps.now || Date.now)();
    const ip = String((req && req.ip) || '').slice(0, 60);

    if (throttled(`${event}|${ip}`, now)) return false;

    const path = String((req && (req.originalUrl || req.url)) || '').split('?')[0].slice(0, 200);
    const who = detail ? mask(detail) : '';

    console.warn('[Security]', JSON.stringify({ event, ip, path, who }));

    const ActivityLog = deps.ActivityLog || require('../models').ActivityLog;

    Promise.resolve(ActivityLog.create({
      admin: 'SECURITY',
      action: who ? `${event} (${who})` : event,
      method: String((req && req.method) || '').slice(0, 10),
      path,
      ip
    })).catch(() => {});

    return true;
  } catch (_) {
    return false; // logging must never break a request
  }
}

function resetForTests() {
  seen.clear();
}

module.exports = { logSecurity, mask, resetForTests };
