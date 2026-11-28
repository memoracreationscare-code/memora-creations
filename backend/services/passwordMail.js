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

function build(user, token, kind = 'admin') {
  const { shell } = require('../utils/emailTemplates');
  const self = kind === 'self';
  const link = `${SITE}/frontend/reset-password.html?token=${encodeURIComponent(token)}`;
  const lasts = self ? '1 ghante' : LINK_DAYS + ' din';

  const body =
    `<p style="margin:0 0 12px">Namaste ${esc(user.fullName)},</p>` +
    (self
      ? '<p style="margin:0 0 12px">Aapne Memora Creations account ka password badalne ki request ki thi. Neeche ke button se naya password set karein.</p>'
      : '<p style="margin:0 0 12px">Aapke Memora Creations account ka password hamari team ne badal diya hai. Naya password humne aapko alag se bataya hoga.</p><p style="margin:0 0 12px">Aap chahein to neeche ke button se apna khud ka password bhi chun sakte hain.</p>') +
    `<p style="margin:0;font-size:13px;color:#6d5a49">Ye link ${lasts} tak chalega aur sirf ek baar use ho sakta hai. Login ke liye aapka mobile number <b>${esc(user.mobile)}</b> hai.</p>` +
    `<p style="margin:14px 0 0;font-size:13px;color:#6d5a49">${self ? 'Agar ye request aapne nahi ki thi, to is email ko ignore karein. Aapka purana password chalta rahega.' : 'Agar aapne password badalne ko nahi kaha tha, to turant humse sampark karein.'}</p>`;

  return {
    subject: self
      ? 'Memora Creations: password change karne ka link'
      : 'Memora Creations: apna naya password set karein',
    html: shell('Apna password set karein', body, { text: 'Naya password set karein', url: link }, { preheader: `Ye link ${lasts} tak chalega.` })
  };
}

const mask = e => String(e).replace(/^(.).*(@.*)$/, '$1***$2');

/* -> { sent: true, to: 'a***@gmail.com' }  or  { sent: false, reason: 'NO_EMAIL' | 'MAIL_NOT_SET_UP' | 'SEND_FAILED' } */
async function sendResetLink(user, token, kind = 'admin') {
  try {
    const to = String((user && user.email) || '').trim();

    if (!to) return { sent: false, reason: 'NO_EMAIL' };
    if (!mail.mailConfigured()) return { sent: false, reason: 'MAIL_NOT_SET_UP' };

    const msg = build(user, token, kind);
    const ok = Boolean(await mail.sendMail({ to, subject: msg.subject, html: msg.html }));

    return ok ? { sent: true, to: mask(to) } : { sent: false, reason: 'SEND_FAILED' };
  } catch (err) {
    console.warn('[Password mail] failed:', err.message);
    return { sent: false, reason: 'SEND_FAILED' };
  }
}

module.exports = { sendResetLink, newLink, build, mask };
