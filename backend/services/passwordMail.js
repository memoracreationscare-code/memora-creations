'use strict';

/*
  Admin changed a customer's password -> email the customer a one-time link
  to choose their own password. The password itself is NEVER put in an email.
  Goes only to the email saved on that customer's own account.
  Never throws: returns true if the mail was sent, otherwise false.
*/

const crypto = require('crypto');
const mail = require('./mailService');

const LINK_DAYS = 7;
const SITE = (process.env.CLIENT_URL || 'https://memoracreationscare.in').replace(/\/$/, '');

const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function newLink() {
  const token = crypto.randomBytes(32).toString('hex');

  return {
    token,
    hash: crypto.createHash('sha256').update(token).digest('hex'),
    expiresAt: new Date(Date.now() + LINK_DAYS * 86400000)
  };
}

function build(user, token) {
  const link = `${SITE}/frontend/reset-password.html?token=${encodeURIComponent(token)}`;

  return {
    subject: 'Memora Creations: apna naya password set karein',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;line-height:1.6;color:#3a2a1d">
        <h2>Namaste ${esc(user.fullName)},</h2>
        <p>Aapke Memora Creations account ka password hamari team ne badal diya hai. Naya password humne aapko alag se bataya hoga.</p>
        <p>Aap chahein to is link se apna khud ka password bhi chun sakte hain:</p>
        <p style="margin:22px 0">
          <a href="${esc(link)}" style="background:#8a5a3b;color:#fff;padding:13px 22px;border-radius:30px;text-decoration:none;font-weight:bold">Apna password set karein</a>
        </p>
        <p>Ye link ${LINK_DAYS} din tak chalega aur sirf ek baar use ho sakta hai. Login ke liye aapka mobile number ${esc(user.mobile)} hai.</p>
        <p>Agar aapne password badalne ko nahi kaha tha, to turant humse sampark karein.</p>
        <p style="color:#7d6e62;font-size:13px">Memora Creations, Kotwa Kalan, Kushinagar, Uttar Pradesh</p>
      </div>`
  };
}

async function sendResetLink(user, token) {
  try {
    const to = String((user && user.email) || '').trim();

    if (!to || !mail.mailConfigured()) return false;

    const msg = build(user, token);

    return Boolean(await mail.sendMail({ to, subject: msg.subject, html: msg.html }));
  } catch (err) {
    console.warn('[Password mail] failed:', err.message);
    return false;
  }
}

module.exports = { sendResetLink, newLink, build };
