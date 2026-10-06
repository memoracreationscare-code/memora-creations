const PROFILE_BASE = '/memora-creations';

let profileUser = null;


/* =========================
   LOAD PROFILE
========================= */

async function loadProfilePage() {

  profileUser =
    await window.MC.requireLogin();

  if (!profileUser) return;


  window.MC.$('#fullName').value =
    profileUser.fullName || '';

  window.MC.$('#mobile').value =
    profileUser.mobile || '';

  window.MC.$('#email').value =
    profileUser.email || '';


  renderAddresses(
    profileUser.addresses || []
  );

}


/* =========================
   RENDER ADDRESSES
========================= */

function renderAddresses(addresses) {

  const box =
    window.MC.$('#addresses');


  box.innerHTML =
    addresses.length

      ? addresses.map(address => `

          <div
            class="card"
            style="margin-bottom:12px;"
          >

            <div class="cardbody">

              <div
                style="
                  display:flex;
                  justify-content:space-between;
                  gap:10px;
                  align-items:center;
                "
              >

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


  /* EDIT */

  window.MC
    .$$('.edit-address')
    .forEach(button => {

      button.onclick = () => {

        const address =
          addresses.find(
            item =>
              item._id ===
              button.dataset.id
          );

        if (!address) return;


        editAddress(address);

      };

    });


  /* DELETE */

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

const profileForm =
  window.MC.$('#profileForm');


if (profileForm) {

  profileForm.addEventListener(
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

}


/* =========================
   ADD ADDRESS
========================= */

const addressForm =
  window.MC.$('#addressForm');


if (addressForm) {

  addressForm.addEventListener(
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


        event.currentTarget.reset();


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

}


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
      'Full name',
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
   REFRESH PROFILE
========================= */

async function refreshProfile() {

  try {

    const data =
      await window.MC.api(
        '/auth/me'
      );


    profileUser =
      data.user;


    window.MC.$('#fullName').value =
      profileUser.fullName || '';

    window.MC.$('#mobile').value =
      profileUser.mobile || '';

    window.MC.$('#email').value =
      profileUser.email || '';


    renderAddresses(
      profileUser.addresses || []
    );


  } catch (error) {

    window.MC.toast(
      error.message ||
      'Profile refresh failed.',
      'error'
    );

  }

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
