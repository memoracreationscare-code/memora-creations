function bindAuthForm(selector, handler) {
  const form = window.MC.$(selector);

  if (form) {
    form.addEventListener('submit', handler);
  }
}


/* =========================
   LOGIN POPUP
========================= */

function showLoginPopup({
  type = 'success',
  title = '',
  message = '',
  buttonText = 'OK',
  onClose = null
}) {

  document
    .querySelector('#loginStatusPopup')
    ?.remove();


  const overlay =
    document.createElement('div');


  overlay.id =
    'loginStatusPopup';


  overlay.style.cssText = `
    position:fixed;
    inset:0;
    z-index:9999;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:20px;
    background:rgba(24,15,10,.68);
    backdrop-filter:blur(5px);
  `;


  const isSuccess =
    type === 'success';


  overlay.innerHTML = `

    <div style="
      position:relative;
      width:min(420px,92vw);
      background:#fffaf6;
      border:1px solid #eadfd5;
      border-radius:26px;
      padding:34px 26px 26px;
      text-align:center;
      box-shadow:0 25px 70px rgba(0,0,0,.28);
      animation:loginPopupIn .22s ease;
    ">

      <div style="
        width:74px;
        height:74px;
        margin:0 auto 18px;
        display:flex;
        align-items:center;
        justify-content:center;
        border-radius:50%;
        font-size:34px;
        background:${
          isSuccess
            ? '#eaf8ef'
            : '#feeceb'
        };
        color:${
          isSuccess
            ? '#147a43'
            : '#b42318'
        };
      ">
        ${
          isSuccess
            ? '✓'
            : '!'
        }
      </div>


      <h2 style="
        margin:0 0 10px;
        font-size:27px;
        color:#2b1b12;
      ">
        ${escapePopupText(title)}
      </h2>


      <p style="
        margin:0 auto 24px;
        max-width:330px;
        color:#756f69;
        font-size:15px;
        line-height:1.6;
      ">
        ${escapePopupText(message)}
      </p>


      <button
        id="loginPopupButton"
        type="button"
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
          box-shadow:0 10px 22px rgba(138,90,59,.22);
        "
      >
        ${escapePopupText(buttonText)}
      </button>

    </div>

  `;


  if (
    !document.querySelector(
      '#loginPopupAnimation'
    )
  ) {

    const style =
      document.createElement('style');


    style.id =
      'loginPopupAnimation';


    style.textContent = `

      @keyframes loginPopupIn {

        from {
          opacity:0;
          transform:scale(.92) translateY(10px);
        }

        to {
          opacity:1;
          transform:scale(1) translateY(0);
        }

      }

    `;


    document.head.appendChild(
      style
    );

  }


  document.body.appendChild(
    overlay
  );


  const closePopup = () => {

    overlay.remove();

    if (
      typeof onClose ===
      'function'
    ) {

      onClose();

    }

  };


  overlay
    .querySelector(
      '#loginPopupButton'
    )
    ?.addEventListener(
      'click',
      closePopup
    );


  if (!isSuccess) {

    overlay.addEventListener(
      'click',
      event => {

        if (
          event.target === overlay
        ) {

          closePopup();

        }

      }
    );

  }

}


/* =========================
   SAFE TEXT
========================= */

function escapePopupText(value) {

  return String(
    value ?? ''
  )
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

}


/* =========================
   LOGIN
========================= */

bindAuthForm(
  '#loginForm',
  async event => {

    event.preventDefault();


    const submitButton =
      event.currentTarget
        .querySelector(
          'button[type="submit"]'
        );


    const oldButtonText =
      submitButton
        ?.innerHTML;


    if (submitButton) {

      submitButton.disabled =
        true;


      submitButton.innerHTML =
        'Logging in...';

    }


    const body =
      Object.fromEntries(
        new FormData(
          event.currentTarget
        )
      );


    try {

      await window.MC.api(
        '/auth/login',
        {

          method:
            'POST',

          body:
            JSON.stringify(
              body
            )

        }
      );


      const next =
        new URLSearchParams(
          location.search
        )
          .get('next');


      showLoginPopup({

        type:
          'success',

        title:
          'Login Successful',

        message:
          'Welcome back to Memora Creations. You have logged in successfully.',

        buttonText:
          'Continue',

        onClose:
          () => {

            location.href =
              next ||
              '/memora-creations/frontend/index.html';

          }

      });


      setTimeout(
        () => {

          if (
            document.querySelector(
              '#loginStatusPopup'
            )
          ) {

            location.href =
              next ||
              '/memora-creations/frontend/index.html';

          }

        },
        1800
      );


    } catch (error) {


      if (submitButton) {

        submitButton.disabled =
          false;


        submitButton.innerHTML =
          oldButtonText ||
          'Login';

      }


      showLoginPopup({

        type:
          'error',

        title:
          'Login Failed',

        message:
          error.message ||
          'Mobile number ya password sahi nahi hai. Please dobara check karein.',

        buttonText:
          'Try Again'

      });

    }

  }
);


/* =========================
   SIGNUP
========================= */

bindAuthForm(
  '#signupForm',
  async event => {

    event.preventDefault();


    const body =
      Object.fromEntries(
        new FormData(
          event.currentTarget
        )
      );


    body.address = {

      addressLine:
        body.addressLine,

      pinCode:
        body.pinCode,

      city:
        body.city,

      state:
        body.state

    };


    delete body.addressLine;
    delete body.pinCode;
    delete body.city;
    delete body.state;


    try {

      await window.MC.api(
        '/auth/register',
        {

          method:
            'POST',

          body:
            JSON.stringify(
              body
            )

        }
      );


      location.href =
        '/memora-creations/frontend/index.html';


    } catch (error) {

      window.MC.toast(
        error.message ||
        'Account creation failed.',
        'error'
      );

    }

  }
);


/* =========================
   FORGOT PASSWORD
========================= */

bindAuthForm(
  '#forgotForm',
  async event => {

    event.preventDefault();


    const body =
      Object.fromEntries(
        new FormData(
          event.currentTarget
        )
      );


    try {

      const data =
        await window.MC.api(
          '/auth/forgot-password',
          {

            method:
              'POST',

            body:
              JSON.stringify(
                body
              )

          }
        );


      window.MC.toast(
        data.message ||
        'Password reset instructions sent.',
        'success'
      );


    } catch (error) {

      window.MC.toast(
        error.message ||
        'Request failed.',
        'error'
      );

    }

  }
);


/* =========================
   RESET PASSWORD
========================= */

bindAuthForm(
  '#resetForm',
  async event => {

    event.preventDefault();


    const body =
      Object.fromEntries(
        new FormData(
          event.currentTarget
        )
      );


    body.token =
      new URLSearchParams(
        location.search
      )
        .get('token');


    try {

      await window.MC.api(
        '/auth/reset-password',
        {

          method:
            'POST',

          body:
            JSON.stringify(
              body
            )

        }
      );


      window.MC.toast(
        'Password reset successful.',
        'success'
      );


      setTimeout(
        () => {

          location.href =
            '/memora-creations/frontend/login.html';

        },
        800
      );


    } catch (error) {

      window.MC.toast(
        error.message ||
        'Password reset failed.',
        'error'
      );

    }

  }
);
