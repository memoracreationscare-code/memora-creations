'use strict';

/*
  Sends one email. Free options, pick one in Render:

  A) Brevo (free 300 emails/day, only needs your sender email verified)
       BREVO_API_KEY=...        MAIL_FROM_EMAIL=you@gmail.com
       MAIL_FROM_NAME=Memora Creations   (optional)

  B) Resend (needs your own domain)
       RESEND_API_KEY=...       MAIL_FROM="Memora <no-reply@yourdomain.com>"

  If neither is set, nothing is sent and nothing breaks.
*/

function provider() {
  if (process.env.BREVO_API_KEY && process.env.MAIL_FROM_EMAIL) return 'brevo';
  if (process.env.RESEND_API_KEY && process.env.MAIL_FROM) return 'resend';

  return null;
}

function mailConfigured() {
  return provider() !== null;
}

async function sendMail({ to, subject, html }) {
  const which = provider();

  if (!which || !to) return false;

  const timeout = AbortSignal.timeout(15000);
  let response;

  if (which === 'brevo') {
    response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        sender: {
          name: process.env.MAIL_FROM_NAME || 'Memora Creations',
          email: process.env.MAIL_FROM_EMAIL
        },
        to: [{ email: to }],
        subject,
        htmlContent: html
      }),
      signal: timeout
    });
  } else {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, html }),
      signal: timeout
    });
  }

  if (!response.ok) {
    let detail = '';

    try { detail = JSON.stringify(await response.json()).slice(0, 200); } catch { /* ignore */ }

    throw new Error(`Email provider refused (${response.status}) ${detail}`);
  }

  return true;
}

module.exports = { sendMail, mailConfigured, provider };
