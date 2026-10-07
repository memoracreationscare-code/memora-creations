let profileUser = null;

let profileSaving = false;
let addressSaving = false;


/* =========================
   HELPERS
========================= */

function isValidMobile(value) {

  return /^[6-9][0-9]{9}$/
    .test(
      String(value || '')
        .trim()
    );

}


function isValidPin(value) {

  return /^[0-9]{6}$/
    .test(
      String(value || '')
        .trim()
    );

}


/* =========================
   FILL PROFILE
========================= */

function fillProfile(user) {

  if (!user) {
    return;
  }


  const fullNameInput =
    window.MC.$(
      '#fullName'
    );


  const mobileInput =
    window.MC.$(
      '#mobile'
    );


  const emailInput =
    window.MC.$(
      '#email'
    );


  if (fullNameInput) {

    fullNameInput.value =
      user.fullName || '';

  }


  if (mobileInput) {

    mobileInput.value =
      user.mobile || '';

  }


  if (emailInput) {

    emailInput.value =
      user.email || '';

  }


  const addresses =
    Array.isArray(
      user.addresses
    )

      ? user.addresses

      : [];


  renderAddresses(
    addresses
  );


  const defaultAddress =
    addresses.find(
      address =>
        address.isDefault
    ) ||
    addresses[0];


  const form =
    window.MC.$(
      '#addressForm'
    );


  if (!form) {
    return;
  }


  const labelInput =
    form.querySelector(
      '[name="label"]'
    );


  const addressNameInput =
    form.querySelector(
      '[name="fullName"]'
    );


  const addressMobileInput =
    form.querySelector(
      '[name="mobile"]'
    );


  const addressLineInput =
    form.querySelector(
      '[name="addressLine"]'
    );


  const pinCodeInput =
    form.querySelector(
      '[name="pinCode"]'
    );


  const cityInput =
    form.querySelector(
      '[name="city"]'
    );


  const stateInput =
    form.querySelector(
      '[name="state"]'
    );


  const defaultCheckbox =
    window.MC.$(
      '#isDefault'
    );


  if (defaultAddress) {

    if (labelInput) {

      labelInput.value =
        defaultAddress.label ||
        'Home';

    }


    if (addressNameInput) {

      addressNameInput.value =
        defaultAddress.fullName ||
        user.fullName ||
        '';

    }


    if (addressMobileInput) {

      addressMobileInput.value =
        defaultAddress.mobile ||
        user.mobile ||
        '';

    }


    if (addressLineInput) {

      addressLineInput.value =
        defaultAddress.addressLine ||
        '';

    }


    if (pinCodeInput) {

      pinCodeInput.value =
        defaultAddress.pinCode ||
        '';

    }


    if (cityInput) {

      cityInput.value =
        defaultAddress.city ||
        '';

    }


    if (stateInput) {

      stateInput.value =
        defaultAddress.state ||
        '';

    }


    if (defaultCheckbox) {

      defaultCheckbox.checked =
        Boolean(
          defaultAddress.isDefault
        );

    }

  } else {

    if (labelInput) {

      labelInput.value =
        '';

    }


    if (addressNameInput) {

      addressNameInput.value =
        user.fullName || '';

    }


    if (addressMobileInput) {

      addressMobileInput.value =
        user.mobile || '';

    }


    if (addressLineInput) {

      addressLineInput.value =
        '';

    }


    if (pinCodeInput) {

      pinCodeInput.value =
        '';

    }


    if (cityInput) {

      cityInput.value =
        '';

    }


    if (stateInput) {

      stateInput.value =
        '';

    }


    if (defaultCheckbox) {

      defaultCheckbox.checked =
        false;

    }

  }

}


/* =========================
   LOAD PROFILE
========================= */

async function loadProfilePage() {

  const user =
    await window.MC
      .requireLogin();


  if (!user) {
    return;
  }


  profileUser =
    user;


  fillProfile(
    profileUser
  );

}


/* =========================
   RENDER ADDRESSES
========================= */

function renderAddresses(
  addresses
) {

  const box =
    window.MC.$(
      '#addresses'
    );


  if (!box) {
    return;
  }


  box.innerHTML =
    addresses.length

      ? addresses
          .map(
            address => `

              <div
                class="card"
                style="
                  margin-bottom:12px;
                "
              >

                <div
                  class="cardbody"
                >

                  <div>

                    <b>

                      ${window.MC.esc(
                        address.label ||
                        'Address'
                      )}

                    </b>


                    ${
                      address.isDefault

                        ? `

                          <span class="pill">
                            Default
                          </span>

                        `

                        : ''
                    }

                  </div>


                  <p>

                    <b>

                      ${window.MC.esc(
                        address.fullName ||
                        ''
                      )}

                    </b>

                    <br>

                    ${window.MC.esc(
                      address.addressLine ||
                      ''
                    )}

                    <br>

                    ${window.MC.esc(
                      address.city ||
                      ''
                    )}

                    ${
                      address.city &&
                      address.state

                        ? ', '

                        : ''
                    }

                    ${window.MC.esc(
                      address.state ||
                      ''
                    )}

                    <br>

                    PIN:
                    ${window.MC.esc(
                      address.pinCode ||
                      ''
                    )}

                    <br>

                    Mobile:
                    ${window.MC.esc(
                      address.mobile ||
                      ''
                    )}

                  </p>


                  <div
                    class="actions"
                  >

                    <button
                      class="btn secondary edit-address"
                      type="button"
                      data-id="${address._id}"
                    >
                      Edit
                    </button>


                    <button
                      class="btn danger delete-address"
                      type="button"
                      data-id="${address._id}"
                    >
                      Delete
                    </button>

                  </div>

                </div>

              </div>

            `
          )
          .join('')

      : `

          <div class="empty">
            No saved addresses.
          </div>

        `;


  window.MC
    .$$(
      '.edit-address'
    )
    .forEach(
      button => {

        button.onclick =
          async () => {

            const address =
              addresses.find(
                item =>
                  String(
                    item._id
                  ) ===
                  String(
                    button.dataset.id
                  )
              );


            if (address) {

              await editAddress(
                address
              );

            }

          };

      }
    );


  window.MC
    .$$(
      '.delete-address'
    )
    .forEach(
      button => {

        button.onclick =
          async () => {

            await deleteAddress(
              button.dataset.id,
              button
            );

          };

      }
    );

}


/* =========================
   SAVE PROFILE
========================= */

const profileForm =
  window.MC.$(
    '#profileForm'
  );


if (profileForm) {

  profileForm.addEventListener(
    'submit',
    async event => {

      event.preventDefault();


      if (profileSaving) {
        return;
      }


      const submitButton =
        event.currentTarget
          .querySelector(
            'button[type="submit"]'
          );


      const oldText =
        submitButton
          ?.textContent ||
        'Save Profile';


      const fullName =
        window.MC
          .$('#fullName')
          ?.value
          .trim() ||
        '';


      const email =
        window.MC
          .$('#email')
          ?.value
          .trim() ||
        '';


      if (!fullName) {

        window.MC.toast(
          'Full Name required hai.',
          'error'
        );

        return;

      }


      profileSaving =
        true;


      if (submitButton) {

        submitButton.disabled =
          true;


        submitButton.textContent =
          'Saving...';

      }


      try {

        await window.MC.api(
          '/profile',
          {

            method:
              'PUT',

            body:
              JSON.stringify({

                fullName,
                email

              })

          }
        );


        window.MC.toast(
          'Profile updated successfully.',
          'success'
        );


        await refreshProfile();


      } catch (error) {

        window.MC.toast(
          error.message ||
          'Profile update failed.',
          'error'
        );


      } finally {

        profileSaving =
          false;


        if (submitButton) {

          submitButton.disabled =
            false;


          submitButton.textContent =
            oldText;

        }

      }

    }
  );

}


/* =========================
   ADD ADDRESS
========================= */

const addressForm =
  window.MC.$(
    '#addressForm'
  );


if (addressForm) {

  addressForm.addEventListener(
    'submit',
    async event => {

      event.preventDefault();


      if (addressSaving) {
        return;
      }


      const form =
        event.currentTarget;


      const submitButton =
        form.querySelector(
          'button[type="submit"]'
        );


      const oldText =
        submitButton
          ?.textContent ||
        'Save Address';


      const body =
        Object.fromEntries(
          new FormData(
            form
          )
        );


      body.fullName =
        String(
          body.fullName || ''
        )
          .trim();


      body.mobile =
        String(
          body.mobile || ''
        )
          .trim();


      body.addressLine =
        String(
          body.addressLine || ''
        )
          .trim();


      body.pinCode =
        String(
          body.pinCode || ''
        )
          .trim();


      body.city =
        String(
          body.city || ''
        )
          .trim();


      body.state =
        String(
          body.state || ''
        )
          .trim();


      body.label =
        String(
          body.label || ''
        )
          .trim();


      body.isDefault =
        Boolean(
          window.MC
            .$('#isDefault')
            ?.checked
        );


      if (
        !body.fullName ||
        !body.addressLine
      ) {

        window.MC.toast(
          'Name aur address required hai.',
          'error'
        );

        return;

      }


      if (
        !isValidMobile(
          body.mobile
        )
      ) {

        window.MC.toast(
          'Valid 10 digit mobile number dalo.',
          'error'
        );

        return;

      }


      if (
        !isValidPin(
          body.pinCode
        )
      ) {

        window.MC.toast(
          'Valid 6 digit PIN Code dalo.',
          'error'
        );

        return;

      }


      addressSaving =
        true;


      if (submitButton) {

        submitButton.disabled =
          true;


        submitButton.textContent =
          'Saving...';

      }


      try {

        await window.MC.api(
          '/profile/addresses',
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
          'Address saved successfully.',
          'success'
        );


        form.reset();


        await refreshProfile();


      } catch (error) {

        window.MC.toast(
          error.message ||
          'Address save failed.',
          'error'
        );


      } finally {

        addressSaving =
          false;


        if (submitButton) {

          submitButton.disabled =
            false;


          submitButton.textContent =
            oldText;

        }

      }

    }
  );

}


/* =========================
   EDIT ADDRESS
========================= */

async function editAddress(
  address
) {

  const label =
    prompt(
      'Label',
      address.label ||
      'Home'
    );


  if (label === null) {
    return;
  }


  const fullName =
    prompt(
      'Full Name',
      address.fullName ||
      ''
    );


  if (fullName === null) {
    return;
  }


  const mobile =
    prompt(
      'Mobile',
      address.mobile ||
      ''
    );


  if (mobile === null) {
    return;
  }


  const addressLine =
    prompt(
      'Address',
      address.addressLine ||
      ''
    );


  if (addressLine === null) {
    return;
  }


  const pinCode =
    prompt(
      'PIN Code',
      address.pinCode ||
      ''
    );


  if (pinCode === null) {
    return;
  }


  const city =
    prompt(
      'City',
      address.city ||
      ''
    );


  if (city === null) {
    return;
  }


  const state =
    prompt(
      'State',
      address.state ||
      ''
    );


  if (state === null) {
    return;
  }


  const cleanMobile =
    String(
      mobile
    )
      .trim();


  const cleanPin =
    String(
      pinCode
    )
      .trim();


  if (
    !isValidMobile(
      cleanMobile
    )
  ) {

    window.MC.toast(
      'Valid 10 digit mobile number dalo.',
      'error'
    );

    return;

  }


  if (
    !isValidPin(
      cleanPin
    )
  ) {

    window.MC.toast(
      'Valid 6 digit PIN Code dalo.',
      'error'
    );

    return;

  }


  const isDefault =
    confirm(
      'Make this the default address?'
    );


  try {

    await window.MC.api(
      '/profile/addresses/' +
      encodeURIComponent(
        address._id
      ),
      {

        method:
          'PUT',

        body:
          JSON.stringify({

            label:
              String(label).trim(),

            fullName:
              String(fullName).trim(),

            mobile:
              cleanMobile,

            addressLine:
              String(
                addressLine
              ).trim(),

            pinCode:
              cleanPin,

            city:
              String(city).trim(),

            state:
              String(state).trim(),

            isDefault

          })

      }
    );


    window.MC.toast(
      'Address updated successfully.',
      'success'
    );


    await refreshProfile();


  } catch (error) {

    window.MC.toast(
      error.message ||
      'Address update failed.',
      'error'
    );

  }

}


/* =========================
   DELETE ADDRESS
========================= */

async function deleteAddress(
  id,
  button = null
) {

  const confirmed =
    confirm(
      'Are you sure you want to delete this address?'
    );


  if (!confirmed) {
    return;
  }


  const oldText =
    button
      ?.textContent ||
    'Delete';


  if (button) {

    button.disabled =
      true;


    button.textContent =
      'Deleting...';

  }


  try {

    await window.MC.api(
      '/profile/addresses/' +
      encodeURIComponent(id),
      {

        method:
          'DELETE'

      }
    );


    window.MC.toast(
      'Address deleted successfully.',
      'success'
    );


    await refreshProfile();


  } catch (error) {

    window.MC.toast(
      error.message ||
      'Address delete failed.',
      'error'
    );


    if (button) {

      button.disabled =
        false;


      button.textContent =
        oldText;

    }

  }

}


/* =========================
   REFRESH PROFILE
========================= */

async function refreshProfile() {

  const data =
    await window.MC.api(
      '/auth/me'
    );


  profileUser =
    data.user || null;


  if (!profileUser) {

    location.href =
      '/memora-creations/frontend/login.html';

    return;

  }


  fillProfile(
    profileUser
  );

}


/* =========================
   START
========================= */

loadProfilePage()
  .catch(
    error => {

      console.error(
        'Profile load error:',
        error
      );


      window.MC.toast(
        error.message ||
        'Profile load failed.',
        'error'
      );

    }
  );
