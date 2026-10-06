function bindAuthForm(selector, handler) {
  const form = window.MC.$(selector);

  if (form) {
    form.addEventListener('submit', handler);
  }
}


/* =========================
   LOGIN
========================= */

bindAuthForm('#loginForm', async event => {
  event.preventDefault();

  const body =
    Object.fromEntries(
      new FormData(event.currentTarget)
    );

  try {
    await window.MC.api('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    const next =
      new URLSearchParams(location.search)
        .get('next');

    location.href =
      next ||
      '/memora-creations/frontend/index.html';

  } catch (error) {
    window.MC.toast(
      error.message || 'Login failed.',
      'error'
    );
  }
});


/* =========================
   SIGNUP
========================= */

bindAuthForm('#signupForm', async event => {
  event.preventDefault();

  const body =
    Object.fromEntries(
      new FormData(event.currentTarget)
    );

  body.address = {
    addressLine: body.addressLine,
    pinCode: body.pinCode,
    city: body.city,
    state: body.state
  };

  delete body.addressLine;
  delete body.pinCode;
  delete body.city;
  delete body.state;

  try {
    await window.MC.api('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    location.href =
      '/memora-creations/frontend/index.html';

  } catch (error) {
    window.MC.toast(
      error.message || 'Account creation failed.',
      'error'
    );
  }
});


/* =========================
   FORGOT PASSWORD
========================= */

bindAuthForm('#forgotForm', async event => {
  event.preventDefault();

  const body =
    Object.fromEntries(
      new FormData(event.currentTarget)
    );

  try {
    const data =
      await window.MC.api(
        '/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify(body)
        }
      );

    window.MC.toast(
      data.message ||
      'Password reset instructions sent.',
      'success'
    );

  } catch (error) {
    window.MC.toast(
      error.message || 'Request failed.',
      'error'
    );
  }
});


/* =========================
   RESET PASSWORD
========================= */

bindAuthForm('#resetForm', async event => {
  event.preventDefault();

  const body =
    Object.fromEntries(
      new FormData(event.currentTarget)
    );

  body.token =
    new URLSearchParams(location.search)
      .get('token');

  try {
    await window.MC.api(
      '/auth/reset-password',
      {
        method: 'POST',
        body: JSON.stringify(body)
      }
    );

    window.MC.toast(
      'Password reset successful.',
      'success'
    );

    setTimeout(() => {
      location.href =
        '/memora-creations/frontend/login.html';
    }, 800);

  } catch (error) {
    window.MC.toast(
      error.message ||
      'Password reset failed.',
      'error'
    );
  }
});
