'use strict';

/*
  Sign-up for people under 18 needs a parent / guardian to say yes
  (India's DPDP Act: verifiable parental consent for children).

  Flow: child signs up with date of birth + parent's name and email ->
  account is created but LOCKED (status PENDING) -> parent gets an email
  with an Approve / Decline link -> only after Approve can the child log in.
*/

const crypto = require('crypto');

const ADULT_AGE = 18;
const LINK_DAYS = 7;
const MIN_AGE = 5;

/* "YYYY-MM-DD" -> Date (UTC midnight), or null if it is not a real, sensible date. */
function parseDob(value, now = new Date()) {
  const text = String(value || '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);

  if (!m) return null;

  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));

  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  if (date > now) return null;

  const age = ageOn(date, now);

  return age >= MIN_AGE && age <= 110 ? date : null;
}

/* Whole years on `now`, counted in India time (IST). */
function ageOn(dob, now = new Date()) {
  const ist = new Date(now.getTime() + 330 * 60000);
  let age = ist.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    ist.getUTCMonth() < dob.getUTCMonth() ||
    (ist.getUTCMonth() === dob.getUTCMonth() && ist.getUTCDate() < dob.getUTCDate());

  if (beforeBirthday) age -= 1;

  return age;
}

const isMinor = (dob, now) => ageOn(dob, now) < ADULT_AGE;

function newToken() {
  const token = crypto.randomBytes(32).toString('hex');

  return { token, hash: hashToken(token) };
}

const hashToken = token => crypto.createHash('sha256').update(String(token)).digest('hex');

const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function consentEmail({ parentName, childName, link }) {
  const { shell } = require('./emailTemplates');

  const body =
    `<p style="margin:0 0 12px">Namaste ${esc(parentName)},</p>` +
    `<p style="margin:0 0 12px"><b>${esc(childName)}</b> ne Memora Creations (home decor aur gifts ki website) par account banana chaha hai. Unki umar 18 saal se kam hai, isliye kanoon ke hisaab se hum aapki (parent / guardian ki) sahmati ke bina account nahi chala sakte.</p>` +
    '<p style="margin:0 0 12px">Account me ye jaankari rahegi: naam, mobile number, delivery address aur orders. Hum ise sirf orders poore karne aur delivery ke liye use karte hain.</p>' +
    `<p style="margin:0;font-size:13px;color:#6d5a49">Ye link ${LINK_DAYS} din tak chalega. Agar aapko is bachche ke baare me pata nahi hai, to bas is email ko ignore karein, account chalu nahi hoga.</p>`;

  return {
    subject: 'Memora Creations: aapke bachche ke account ke liye aapki sahmati chahiye',
    html: shell('Parent / Guardian ki sahmati', body, { text: 'Dekhein aur faisla karein', url: link }, { preheader: `${childName} ke account ke liye aapki sahmati chahiye.` })
  };
}

module.exports = { ADULT_AGE, LINK_DAYS, parseDob, ageOn, isMinor, newToken, hashToken, consentEmail };
