let profileUser = null;


/* =========================
   FILL PROFILE
========================= */

function fillProfile(user) {

  if (!user) return;

  window.MC.$('#fullName').value =
    user.fullName || '';

  window.MC.$('#mobile').value =
    user.mobile || '';

  window.MC.$('#email').value =
    user.email || '';


  const addresses =
    user.addresses || [];


  renderAddresses(addresses);


  /* DEFAULT ADDRESS AUTO FILL */

  const defaultAddress =
    addresses.find(
      address => address.isDefault
    ) ||
    addresses[0];


  if (defaultAddress) {

    const form =
      window.MC.$('#addressForm');

    if (!form) return;


    const label =
      form.querySelector(
        '[name="label"]'
      );

    const fullName =
      form.querySelector(
        '[name="fullName"]'
      );

    const mobile =
      form.querySelector(
        '[name="mobile"]'
      );

    const addressLine =
      form.querySelector(
        '[name="addressLine"]'
      );

    const pinCode =
      form.querySelector(
        '[name="pinCode"]'
      );

    const city =
      form.querySelector(
        '[name="city"]'
      );

    const state =
      form.querySelector(
        '[name="state"]'
      );


    if (label) {
      label.value =
        defaultAddress.label || 'Home';
    }

    if (fullName) {
      fullName.value =
        defaultAddress.fullName ||
        user.fullName ||
        '';
    }

    if (mobile) {
      mobile.value =
        defaultAddress.mobile ||
        user.mobile ||
        '';
    }

    if (addressLine) {
      addressLine.value =
        defaultAddress.addressLine || '';
    }

    if (pinCode) {
      pinCode.value =
        defaultAddress.pinCode || '';
    }

    if (city) {
      city.value =
        defaultAddress.city || '';
    }

    if (state) {
      state.value =
        defaultAddress.state || '';
    }

    const defaultCheckbox =
      window.MC.$('#isDefault');

    if (defaultCheckbox) {
      defaultCheckbox.checked =
        Boolean(
          defaultAddress.isDefault
        );
    }

  } else {

    /* IF ADDRESS NOT FOUND */

    const form =
      window.MC.$('#addressForm');

    if (form) {

      const nameInput =
        form.querySelector(
          '[name="fullName"]'
        );

      const mobileInput =
        form.querySelector(
          '[name="mobile"]'
        );


      if (nameInput) {
        nameInput.value =
          user.fullName || '';
      }

      if (mobileInput) {
        mobileInput.value =
          user.mobile || '';
      }

    }

  }

}


/* =========================
   LOAD PROFILE
========================= */

async function loadProfilePage() {

  const data =
    await window.MC.api(
      '/auth/me'
    );


  profileUser =
    data.user;


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
   RENDER ADDRESSES
========================= */

function renderAddresses(addresses) {

  const box =
    window.MC.$('#addresses');


  if (!box) return;


  box.innerHTML =
    addresses.length

      ? addresses.map(address => `

          <div
            class="card"
            style="margin-bottom:12px;"
          >

            <div class="cardbody">

              <div>

                <b>
                  ${window.MC.esc(
                    address.label || 'Address'
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
                    address.fullName
                  )}
                </b>

                <br>

                ${window.MC.esc(
                  address.addressLine
                )}

                <br>

                ${window.MC.esc(
                  address.city || ''
                )}

                ${
                  address.city &&
                  address.state
                    ? ', '
                    : ''
                }

                ${window.MC.esc(
                  address.state || ''
                )}

                <br>

                PIN:
                ${window.MC.esc(
                  address.pinCode
                )}

                <br>

                Mobile:
                ${window.MC.esc(
                  address.mobile
                )}

              </p>


              <div class="actions">

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

        `).join('')

      : `
          <div class="empty">
            No saved addresses.
          </div>
        `;


  window.MC
    .$$('.edit-address')
    .forEach(button => {

      button.onclick = () => {

        const address =
          addresses.find(
            item =>
              String(item._id) ===
              String(button.dataset.id)
          );

        if (address) {
          editAddress(address);
        }

      };

    });


  window.MC
    .$$('.delete-address')
    .forEach(button => {

      button.onclick = () => {

        deleteAddress(
          button.dataset.id
        );

      };

    });

}


/* =========================
   SAVE PROFILE
========================= */

window.MC.$('#profileForm')
  ?.addEventListener(
    'submit',
    async event => {

      event.preventDefault();


      try {

        await window.MC.api(
          '/profile',
          {
            method: 'PUT',

            body: JSON.stringify({

              fullName:
                window.MC
                  .$('#fullName')
                  .value
                  .trim(),

              email:
                window.MC
                  .$('#email')
                  .value
                  .trim()

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

      }

    }
  );


/* =========================
   ADD ADDRESS
========================= */

window.MC.$('#addressForm')
  ?.addEventListener(
    'submit',
    async event => {

      event.preventDefault();


      const body =
        Object.fromEntries(
          new FormData(
            event.currentTarget
          )
        );


      body.isDefault =
        window.MC
          .$('#isDefault')
          .checked;


      try {

        await window.MC.api(
          '/profile/addresses',
          {
            method: 'POST',
            body:
              JSON.stringify(body)
          }
        );


        window.MC.toast(
          'Address saved successfully.',
          'success'
        );


        await refreshProfile();


      } catch (error) {

        window.MC.toast(
          error.message ||
          'Address save failed.',
          'error'
        );

      }

    }
  );


/* =========================
   EDIT ADDRESS
========================= */

async function editAddress(address) {

  const label =
    prompt(
      'Label',
      address.label || 'Home'
    );

  if (label === null) return;


  const fullName =
    prompt(
      'Full Name',
      address.fullName || ''
    );

  if (fullName === null) return;


  const mobile =
    prompt(
      'Mobile',
      address.mobile || ''
    );

  if (mobile === null) return;


  const addressLine =
    prompt(
      'Address',
      address.addressLine || ''
    );

  if (addressLine === null) return;


  const pinCode =
    prompt(
      'PIN Code',
      address.pinCode || ''
    );

  if (pinCode === null) return;


  const city =
    prompt(
      'City',
      address.city || ''
    );

  if (city === null) return;


  const state =
    prompt(
      'State',
      address.state || ''
    );

  if (state === null) return;


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
        method: 'PUT',

        body: JSON.stringify({
          label,
          fullName,
          mobile,
          addressLine,
          pinCode,
          city,
          state,
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

async function deleteAddress(id) {

  const confirmed =
    confirm(
      'Are you sure you want to delete this address?'
    );


  if (!confirmed) return;


  try {

    await window.MC.api(
      '/profile/addresses/' +
      encodeURIComponent(id),
      {
        method: 'DELETE'
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

  }

}


/* =========================
   REFRESH
========================= */

async function refreshProfile() {

  const data =
    await window.MC.api(
      '/auth/me'
    );


  profileUser =
    data.user;


  fillProfile(
    profileUser
  );

}


/* =========================
   START
========================= */

loadProfilePage().catch(
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
