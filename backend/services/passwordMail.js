'use strict';

/*
  Admin changed a customer's password -> email the customer the new one.
  Goes only to the email saved on that customer's own account.
  Never throws: returns true if the mail was sent, otherwise false.
*/

const mail = require('./mailService');

const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function build(user, password) {
  return {
    subject: 'Memora Creations: aapka password badal diya gaya hai',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;line-height:1.6;color:#3a2a1d">
        <h2>Namaste ${esc(user.fullName)},</h2>
        <p>Aapki request par Memora Creations ne aapke account ka password badal diya hai.</p>
        <p>Aapka naya password:</p>
        <p style="font-size:20px;font-weight:bold;letter-spacing:.5px;background:#f6eee6;border-radius:10px;padding:12px 16px;display:inline-block;margin:4px 0">${esc(password)}</p>
        <p>Mobile number ${esc(user.mobile)} aur is password se login karein. Surakhsha ke liye login karke <b>Profile</b> me jaakar apna password badal lein, aur ye email kisi ko na dikhayein.</p>
        <p>Agar aapne password badalne ko nahi kaha tha, to turant humse sampark karein.</p>
        <p style="color:#7d6e62;font-size:13px">Memora Creations, Kotwa Kalan, Kushinagar, Uttar Pradesh</p>
      </div>`
  };
}

async function sendNewPassword(user, password) {
  try {
    const to = String((user && user.email) || '').trim();

    if (!to || !mail.mailConfigured()) return false;

    const msg = build(user, password);

    return Boolean(await mail.sendMail({ to, subject: msg.subject, html: msg.html }));
  } catch (err) {
    console.warn('[Password mail] failed:', err.message);
    return false;
  }
}

module.exports = { sendNewPassword, build };
