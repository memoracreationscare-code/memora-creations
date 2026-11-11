'use strict';

/*
  Authenticator-app codes (TOTP, RFC 6238: SHA-1, 30 seconds, 6 digits),
  built only on Node's crypto so no extra package is needed. Works with
  Google Authenticator, Microsoft Authenticator, Authy, etc.
*/

const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP = 30;

function base32Encode(buffer) {
  let bits = '';

  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');

  let out = '';

  for (let i = 0; i < bits.length; i += 5) out += ALPHABET[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];

  return out;
}

function base32Decode(text) {
  let bits = '';

  for (const c of String(text).toUpperCase().replace(/[\s=-]/g, '')) {
    const i = ALPHABET.indexOf(c);

    if (i < 0) throw new Error('Invalid base32');
    bits += i.toString(2).padStart(5, '0');
  }

  const bytes = [];

  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));

  return Buffer.from(bytes);
}

const generateSecret = () => base32Encode(crypto.randomBytes(20));

function codeAt(secret, counter) {
  const buf = Buffer.alloc(8);

  buf.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];

  return String(bin % 1000000).padStart(6, '0');
}

const stepOf = (ms = Date.now()) => Math.floor(ms / 1000 / STEP);

/*
  Returns the matching time-step (a number) or null. One step of drift either
  way is allowed. `afterStep` rejects a code that was already used.
*/
function verify(secret, token, { now = Date.now(), afterStep = -1 } = {}) {
  const given = String(token || '').replace(/\s/g, '');

  if (!/^\d{6}$/.test(given)) return null;

  const current = stepOf(now);

  for (const step of [current, current - 1, current + 1]) {
    if (step <= afterStep) continue;

    const a = Buffer.from(codeAt(secret, step));
    const b = Buffer.from(given);

    if (crypto.timingSafeEqual(a, b)) return step;
  }

  return null;
}

const otpauthUrl = (secret, account, issuer = 'Memora Creations') =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP}`;

module.exports = { generateSecret, verify, codeAt, stepOf, otpauthUrl, base32Encode, base32Decode };
