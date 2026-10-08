function bindAuthForm(
  selector,
  handler
) {

  const form =
    window.MC.$(
      selector
    );


  if (form) {

    form.addEventListener(
      'submit',
      handler
    );

  }

}


/* =========================
   SAFE TEXT
========================= */

function escapePopupText(
  value
) {

  return String(
    value ?? ''
  )
    .replaceAll(
      '&',
      '&amp;'
    )
    .replaceAll(
      '<',
      '&lt;'
    )
    .replaceAll(
      '>',
      '&gt;'
    )
    .replaceAll(
      '"',
      '&quot;'
    )
    .replaceAll(
      "'",
      '&#039;'
    );

}


/* =========================
   STATUS POPUP
========================= */

function showStatusPopup({
  type = 'success',
  title = '',
  message = '',
  buttonText = 'OK',
  onClose = null
}) {

  document
    .querySelector(
      '#authStatusPopup'
    )
    ?.remove();


  const overlay =
    document.createElement(
      'div'
    );


  overlay.id =
    'authStatusPopup';


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

    <div
      style="
        position:relative;
        width:min(420px,92vw);
        background:#fffaf6;
        border:1px solid #eadfd5;
        border-radius:26px;
        padding:34px 26px 26px;
        text-align:center;
        box-shadow:0 25px 70px rgba(0,0,0,.28);
        animation:authPopupIn .22s ease;
      "
    >

      <div
        style="
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
        "
      >

        ${
          isSuccess
            ? '✓'
            : '!'
        }

      </div>


      <h2
        style="
          margin:0 0 10px;
          font-size:27px;
          color:#2b1b12;
        "
      >

        ${escapePopupText(
          title
        )}

      </h2>


      <p
        style="
          margin:0 auto 24px;
          max-width:330px;
          color:#756f69;
          font-size:15px;
          line-height:1.6;
        "
      >

        ${escapePopupText(
          message
        )}

      </p>


      <button
        id="authPopupButton"
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

        ${escapePopupText(
          buttonText
        )}

      </button>

    </div>

  `;


  if (
    !document.querySelector(
      '#authPopupAnimation'
    )
  ) {

    const style =
      document.createElement(
        'style'
      );


    style.id =
      'authPopupAnimation';


    style.textContent = `

      @keyframes authPopupIn {

        from {
          opacity:0;
          transform:
            scale(.92)
            translateY(10px);
        }

        to {
          opacity:1;
          transform:
            scale(1)
            translateY(0);
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


  const closePopup =
    () => {

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
      '#authPopupButton'
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
   LOGIN
========================= */

bindAuthForm(
  '#loginForm',
  async event => {

    event.preventDefault();


    const form =
      event.currentTarget;


    if (
      form.dataset.submitting ===
      'true'
    ) {

      return;

    }


    const submitButton =
      form.querySelector(
        'button[type="submit"]'
      );


    const oldButtonText =
      submitButton
        ?.innerHTML ||
      'Login';


    form.dataset.submitting =
      'true';


    if (submitButton) {

      submitButton.disabled =
        true;


      submitButton.innerHTML =
        'Logging in...';

    }


    const body =
      Object.fromEntries(
        new FormData(
          form
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


      const destination =
        next ||
        '/memora-creations/frontend/index.html';


      showStatusPopup({

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
              destination;

          }

      });


    } catch (error) {

      form.dataset.submitting =
        'false';


      if (submitButton) {

        submitButton.disabled =
          false;


        submitButton.innerHTML =
          oldButtonText;

      }


      showStatusPopup({

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


    const form =
      event.currentTarget;


    if (
      form.dataset.submitting ===
      'true'
    ) {

      return;

    }


    form.dataset.submitting =
      'true';


    const submitButton =
      form.querySelector(
        'button[type="submit"]'
      );


    const oldText =
      submitButton
        ?.innerHTML ||
      'Create Account';


    if (submitButton) {

      submitButton.disabled =
        true;


      submitButton.innerHTML =
        'Creating...';

    }


    const body =
      Object.fromEntries(
        new FormData(
          form
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


      showStatusPopup({

        type:
          'success',

        title:
          'Account Created Successfully',

        message:
          'Welcome to Memora Creations. Your account has been created successfully.',

        buttonText:
          'Continue',

        onClose:
          () => {

            location.href =
              '/memora-creations/frontend/index.html';

          }

      });


    } catch (error) {

      form.dataset.submitting =
        'false';


      if (submitButton) {

        submitButton.disabled =
          false;


        submitButton.innerHTML =
          oldText;

      }


      showStatusPopup({

        type:
          'error',

        title:
          'Account Creation Failed',

        message:
          error.message ||
          'Account create nahi ho paya. Please details dobara check karein.',

        buttonText:
          'Try Again'

      });

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


    const form =
      event.currentTarget;


    if (
      form.dataset.submitting ===
      'true'
    ) {

      return;

    }


    form.dataset.submitting =
      'true';


    const submitButton =
      form.querySelector(
        'button[type="submit"]'
      );


    const oldText =
      submitButton
        ?.innerHTML ||
      'Submit';


    if (submitButton) {

      submitButton.disabled =
        true;


      submitButton.innerHTML =
        'Please wait...';

    }


    const body =
      Object.fromEntries(
        new FormData(
          form
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


      showStatusPopup({

        type:
          'success',

        title:
          'Request Submitted',

        message:
          data.message ||
          'Password reset ke liye support se contact karein.',

        buttonText:
          'OK'

      });


    } catch (error) {

      showStatusPopup({

        type:
          'error',

        title:
          'Request Failed',

        message:
          error.message ||
          'Request submit nahi ho paya.',

        buttonText:
          'Try Again'

      });

    } finally {

      form.dataset.submitting =
        'false';


      if (submitButton) {

        submitButton.disabled =
          false;


        submitButton.innerHTML =
          oldText;

      }

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


    const form =
      event.currentTarget;


    if (
      form.dataset.submitting ===
      'true'
    ) {

      return;

    }


    form.dataset.submitting =
      'true';


    const submitButton =
      form.querySelector(
        'button[type="submit"]'
      );


    const oldText =
      submitButton
        ?.innerHTML ||
      'Reset Password';


    if (submitButton) {

      submitButton.disabled =
        true;


      submitButton.innerHTML =
        'Resetting...';

    }


    const body =
      Object.fromEntries(
        new FormData(
          form
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


      showStatusPopup({

        type:
          'success',

        title:
          'Password Updated',

        message:
          'Password successfully reset ho gaya hai. Ab aap login kar sakte hain.',

        buttonText:
          'Go to Login',

        onClose:
          () => {

            location.href =
              '/memora-creations/frontend/login.html';

          }

      });


    } catch (error) {

      form.dataset.submitting =
        'false';


      if (submitButton) {

        submitButton.disabled =
          false;


        submitButton.innerHTML =
          oldText;

      }


      showStatusPopup({

        type:
          'error',

        title:
          'Password Reset Failed',

        message:
          error.message ||
          'Password reset nahi ho paya.',

        buttonText:
          'Try Again'

      });

    }

  }
);
