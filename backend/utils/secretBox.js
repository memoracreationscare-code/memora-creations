'use strict';

/* Encrypts small secrets (the 2-step key) before they are stored in the database. */

const crypto = require('crypto');

function key() {
  const secret = process.env.JWT_SECRET;

  if (!secret) throw new Error('JWT_SECRET is required to protect 2-step login keys.');

  return crypto.createHash('sha256').update('memora-2fa:' + secret).digest();
}

function seal(text) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);

  return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64')).join('.');
}

function open(sealed) {
  const [iv, tag, data] = String(sealed).split('.').map(p => Buffer.from(p, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);

  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

module.exports = { seal, open };
