
/*
========================================
 MEMORA CREATIONS
 CUSTOMER AUTHENTICATION
 FULL REPLACEMENT — V12

 Login
 Signup
 Forgot Password
 Reset Password
 Safe Redirect
 Duplicate Submit Protection
========================================
*/

(() => {
  'use strict';

  const MC = window.MC;

  if (!MC || typeof MC.api !== 'function') {
    console.error('Memora app.js is required before auth.js');
    return;
  }

  const BASE = '/memora-creations';
  const HOME = BASE + '/frontend/index.html';
  const LOGIN = BASE + '/frontend/login.html';

  const $ = selector => document.querySelector(selector);

  /* SAFE TEXT */

  function escapeText(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  /* STATUS POPUP */

  function showStatusPopup({
    type = 'success',
    title = '',
    message = '',
    buttonText = 'OK',
    onClose = null
  } = {}) {

    $('#authStatusPopup')?.remove();

    const success = type === 'success';

    const overlay = document.createElement('div');
    overlay.id = 'authStatusPopup';

    overlay.style.cssText = `
      position:fixed;
      inset:0;
      z-index:99999;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:20px;
      background:rgba(24,15,10,.68);
      backdrop-filter:blur(5px);
    `;

    overlay.innerHTML = `
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="authPopupTitle"
        style="
          width:min(420px,92vw);
          background:#fffaf6;
          border:1px solid #eadfd5;
          border-radius:24px;
          padding:32px 25px 25px;
          text-align:center;
          box-shadow:0 25px 70px rgba(0,0,0,.28);
        "
      >

        <div style="
          width:70px;
          height:70px;
          margin:0 auto 18px;
          display:flex;
          align-items:center;
          justify-content:center;
          border-radius:50%;
          background:${success ? '#eaf8ef' : '#feeceb'};
          color:${success ? '#147a43' : '#b42318'};
          font-size:32px;
          font-weight:800;
        ">
          ${success ? '✓' : '!'}
        </div>

        <h2
          id="authPopupTitle"
          style="
            margin:0 0 12px;
            font-size:26px;
            color:#2b1b12;
          "
        >
          ${escapeText(title)}
        </h2>

        <p style="
          margin:0 0 24px;
          color:#756f69;
          font-size:15px;
          line-height:1.7;
          overflow-wrap:anywhere;
        ">
          ${escapeText(message)}
        </p>

        <button
          type="button"
          id="authPopupButton"
          style="
            width:100%;
            min-height:52px;
            border:0;
            border-radius:999px;
            background:linear-gradient(180deg,#9b613c,#7e492a);
            color:white;
            font-size:16px;
            font-weight:800;
            cursor:pointer;
          "
        >
          ${escapeText(buttonText)}
        </button>

      </div>
    `;

    document.body.appendChild(overlay);

    const button = $('#authPopupButton');

    const close = () => {
      overlay.remove();

      if (typeof onClose === 'function') {
        onClose();
      }
    };

    button?.addEventListener('click', close);

    if (!success) {
      overlay.addEventListener('click', event => {
        if (event.target === overlay) {
          close();
        }
      });
    }

    button?.focus();
  }

  /* SAFE REDIRECT */

  function safeDestination() {
    const fallback = HOME;
    const rawNext =
      new URLSearchParams(location.search).get('next');

    if (!rawNext) return fallback;

    if (
      !rawNext.startsWith('/') ||
      rawNext.startsWith('//') ||
      rawNext.includes('\\') ||
      rawNext.includes('\r') ||
      rawNext.includes('\n')
    ) {
      return fallback;
    }

    try {
      const url = new URL(rawNext, location.origin);

      if (
        url.origin !== location.origin ||
        !url.pathname.startsWith(BASE + '/frontend/')
      ) {
        return fallback;
      }

      return url.pathname + url.search + url.hash;

    } catch {
      return fallback;
    }
  }

  /* COMMON FORM HANDLER */

  function bindForm(
    selector,
    {
      loadingText,
      endpoint,
      transform = data => data,
      successTitle,
      successMessage,
      successButton = 'Continue',
      successRedirect = null,
      onSuccess = null,
      errorTitle
    }
  ) {

    const form = $(selector);
    if (!form) return;

    form.addEventListener('submit', async event => {
      event.preventDefault();

      if (form.dataset.submitting === 'true') {
        return;
      }

      if (!form.reportValidity()) return;

      const button =
        form.querySelector('button[type="submit"]');

      const previousHTML =
        button?.innerHTML || 'Submit';

      form.dataset.submitting = 'true';

      if (button) {
        button.disabled = true;
        button.textContent = loadingText;
      }

      try {
        const formData = Object.fromEntries(
          new FormData(form).entries()
        );

        const body = transform(formData);

        const result = await MC.api(endpoint, {
          method: 'POST',
          body: JSON.stringify(body)
        });

        if (typeof onSuccess === 'function') {
          try { onSuccess(result); } catch (e) { /* never block login */ }
        }

        showStatusPopup({
          type: 'success',
          title: successTitle,
          message:
            typeof successMessage === 'function'
              ? successMessage(result)
              : successMessage,
          buttonText: successButton,
          onClose: successRedirect
            ? () => {
                location.href =
                  typeof successRedirect === 'function'
                    ? successRedirect()
                    : successRedirect;
              }
            : null
        });

      } catch (error) {

        showStatusPopup({
          type: 'error',
          title: errorTitle,
          message:
            error?.message ||
            'Request failed. Please try again.',
          buttonText: 'Try Again'
        });

      } finally {

        form.dataset.submitting = 'false';

        if (button) {
          button.disabled = false;
          button.innerHTML = previousHTML;
        }
      }

    });
  }

  /* LOGIN */

  bindForm('#loginForm', {
    loadingText: 'Logging in...',
    endpoint: '/auth/login',

    successTitle: 'Login Successful',

    successMessage:
      'Welcome back to Memora Creations. You have logged in successfully.',

    successRedirect: safeDestination,

    // Greets the customer with the welcome voice (see welcome-voice.js)
    onSuccess: () => window.dispatchEvent(new Event('mc:login-success')),

    errorTitle: 'Login Failed'
  });

  /* SIGNUP */

  bindForm('#signupForm', {
    loadingText: 'Creating Account...',
    endpoint: '/auth/register',

    transform(data) {
      const body = { ...data };

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

      return body;
    },

    successTitle: 'Account Created Successfully',

    successMessage:
      'Welcome to Memora Creations. Your account has been created successfully.',

    successRedirect: HOME,

    errorTitle: 'Account Creation Failed'
  });

  /* FORGOT PASSWORD */

  bindForm('#forgotForm', {
    loadingText: 'Please wait...',
    endpoint: '/auth/forgot-password',

    successTitle: 'Request Submitted',

    successMessage(result) {
      return result?.message ||
        'Password reset request submitted.';
    },

    successButton: 'OK',

    errorTitle: 'Request Failed'
  });

  /* RESET PASSWORD */

  bindForm('#resetForm', {
    loadingText: 'Resetting Password...',
    endpoint: '/auth/reset-password',

    transform(data) {
      return {
        ...data,
        token:
          new URLSearchParams(location.search)
            .get('token')
      };
    },

    successTitle: 'Password Updated',

    successMessage:
      'Password successfully reset ho gaya hai. Ab aap login kar sakte hain.',

    successButton: 'Go to Login',

    successRedirect: LOGIN,

    errorTitle: 'Password Reset Failed'
  });

})();
