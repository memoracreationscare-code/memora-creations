'use strict';

/*
  WEB PUSH (no extra packages)

  We send an EMPTY push signed with our VAPID key. The browser wakes the
  service worker (frontend/sw.js), which asks /api/push/latest for the
  text and shows the notification. This avoids payload encryption, so only
  Node's built-in crypto is needed.
*/

const crypto = require('crypto');

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function generateKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1'
  });

  const jwk = publicKey.export({ format: 'jwk' });
  const raw = Buffer.concat([
    Buffer.from([0x04]),
    Buffer.from(jwk.x, 'base64'),
    Buffer.from(jwk.y, 'base64')
  ]);

  return {
    publicKey: b64url(raw),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' })
  };
}

function vapidAuthHeader(endpoint, keys, subject, now = Date.now()) {
  const aud = new URL(endpoint).origin;
  const header = b64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64url(
    JSON.stringify({
      aud,
      exp: Math.floor(now / 1000) + 12 * 60 * 60,
      sub: subject
    })
  );
  const data = `${header}.${claims}`;
  const signature = crypto.sign('sha256', Buffer.from(data), {
    key: keys.privateKeyPem,
    dsaEncoding: 'ieee-p1363'
  });

  return `vapid t=${data}.${b64url(signature)}, k=${keys.publicKey}`;
}

function isPushEndpoint(value) {
  try {
    const u = new URL(String(value));
    return u.protocol === 'https:' && String(value).length <= 1000;
  } catch (_) {
    return false;
  }
}

/* Returns 'ok' | 'gone' (subscription is dead, delete it) | 'error' */
async function sendOne(sub, keys, subject, fetchImpl = globalThis.fetch) {
  try {
    const res = await fetchImpl(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: vapidAuthHeader(sub.endpoint, keys, subject),
        TTL: '86400',
        Urgency: 'normal',
        'Content-Length': '0'
      }
    });

    if (res.status >= 200 && res.status < 300) return 'ok';
    if (res.status === 404 || res.status === 410) return 'gone';
    return 'error';
  } catch (_) {
    return 'error';
  }
}

async function sendToAll(subs, keys, subject, fetchImpl, batch = 20) {
  const result = { sent: 0, failed: 0, gone: [] };

  for (let i = 0; i < subs.length; i += batch) {
    const part = subs.slice(i, i + batch);
    const out = await Promise.all(
      part.map(s => sendOne(s, keys, subject, fetchImpl))
    );

    out.forEach((r, idx) => {
      if (r === 'ok') result.sent += 1;
      else {
        result.failed += 1;
        if (r === 'gone') result.gone.push(part[idx].endpoint);
      }
    });
  }

  return result;
}

module.exports = {
  generateKeys,
  vapidAuthHeader,
  isPushEndpoint,
  sendOne,
  sendToAll,
  b64url
};
