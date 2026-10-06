function configured() {
  return Boolean(
    process.env.RESEND_API_KEY &&
    process.env.MAIL_FROM
  );
}

async function sendPasswordResetEmail(to, token) {
  if (!configured()) return false;

  const base =
    process.env.CLIENT_URL ||
    'http://localhost:5000';

  const link =
    `${base}/frontend/reset-password.html?token=${encodeURIComponent(token)}`;

  const response = await fetch(
    'https://api.resend.com/emails',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [to],
        subject: 'MEMORA CREATIONS password reset',
        html: `
          <h2>Reset your password</h2>
          <p>Click the button below to reset your MEMORA CREATIONS password.</p>
          <p>
            <a href="${link}">
              Reset Password
            </a>
          </p>
          <p>This link will expire in 30 minutes.</p>
        `
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error('Resend error:', data);
    throw new Error(
      data?.message ||
      'Failed to send password reset email.'
    );
  }

  return true;
}

module.exports = {
  sendPasswordResetEmail,
  configured
};
