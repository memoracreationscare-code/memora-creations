const nodemailer = require('nodemailer');

function configured() { return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.MAIL_FROM); }
function transporter() {
  if (!configured()) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE) === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
  });
}

async function sendPasswordResetEmail(to, token) {
  const tx = transporter();
  if (!tx) return false;
  const base = process.env.CLIENT_URL || 'http://localhost:5000';
  const link = `${base}/frontend/reset-password.html?token=${encodeURIComponent(token)}`;
  await tx.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject: 'MEMORA CREATIONS password reset',
    text: `Reset your password using this link: ${link}`
  });
  return true;
}

module.exports = { sendPasswordResetEmail, configured };
