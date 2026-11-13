let profileUser = null;

let profileSaving = false;
let addressSaving = false;


/* =========================
   VALIDATION
========================= */

function isValidMobile(
  value
) {

  return /^[6-9][0-9]{9}$/
    .test(
      String(
        value || ''
      ).trim()
    );

}


function isValidPin(
  value
) {

  return /^[0-9]{6}$/
    .test(
      String(
        value || ''
      ).trim()
    );

}


/* =========================
   FILL PROFILE
========================= */

function fillProfile(
  user
) {

  if (!user) {
    return;
  }


  const fullName =
    window.MC.$(
      '#fullName'
    );


  const mobile =
    window.MC.$(
      '#mobile'
    );


  const email =
    window.MC.$(
      '#email'
    );


  if (fullName) {

    fullName.value =
      user.fullName ||
      '';

  }


  if (mobile) {

    mobile.value =
      user.mobile ||
      '';

  }


  if (email) {

    email.value =
      user.email ||
      '';

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


  resetAddressForm();

  renderProfileSummary(user);

}


/* =========================
   SUMMARY CARD (name, initials, quick links)
========================= */

function renderProfileSummary(user) {

  const box = window.MC.$('#profileSummary');

  if (!box || !user) {
    return;
  }

  const name = String(user.fullName || '').trim();

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join('') || 'M';

  setAvatarView(user.avatar, initials);
  window.MC.$('#profileSummaryName').textContent = name || 'Welcome';
  window.MC.$('#profileSummaryMobile').textContent =
    user.mobile ? '+91 ' + user.mobile : '';

  box.hidden = false;

}


/* =========================
   PROFILE PHOTO
   The photo is cropped square and shrunk to
   256px in the browser, so it stays small.
========================= */

function setAvatarView(avatar, initials) {

  const box = window.MC.$('#profileAvatar');
  const actions = window.MC.$('#avatarActions');

  if (!box) {
    return;
  }

  box.textContent = '';
  box.style.backgroundImage = '';

  if (avatar) {
    box.style.backgroundImage = 'url("' + avatar + '")';
    box.classList.add('has-photo');
  } else {
    box.classList.remove('has-photo');
    box.textContent = initials || 'M';
  }

  if (actions) {
    actions.hidden = !avatar;
  }

}


function shrinkImage(file) {

  return new Promise((resolve, reject) => {

    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {

      const size = 256;
      const side = Math.min(image.width, image.height);
      const canvas = document.createElement('canvas');

      canvas.width = size;
      canvas.height = size;

      canvas.getContext('2d').drawImage(
        image,
        (image.width - side) / 2,
        (image.height - side) / 2,
        side,
        side,
        0,
        0,
        size,
        size
      );

      URL.revokeObjectURL(url);

      let quality = 0.85;
      let data = canvas.toDataURL('image/jpeg', quality);

      while (data.length > 90000 && quality > 0.4) {
        quality -= 0.15;
        data = canvas.toDataURL('image/jpeg', quality);
      }

      resolve(data);

    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Yeh photo khul nahi paayi.'));
    };

    image.src = url;

  });

}


async function saveAvatar(avatar) {

  const data = await window.MC.api('/profile/avatar', {
    method: 'PUT',
    body: JSON.stringify({ avatar })
  });

  if (profileUser) {
    profileUser.avatar = data.avatar || '';
  }

  renderProfileSummary(profileUser);

}


const avatarPick = window.MC.$('#avatarPick');
const avatarFile = window.MC.$('#avatarFile');
const avatarRemove = window.MC.$('#avatarRemove');

if (avatarPick && avatarFile) {

  avatarPick.addEventListener('click', () => avatarFile.click());

  avatarFile.addEventListener('change', async () => {

    const file = avatarFile.files[0];
    avatarFile.value = '';

    if (!file) {
      return;
    }

    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      window.MC.toast('Sirf JPG, PNG ya WebP photo chunein.', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      window.MC.toast('Photo 10 MB se chhoti honi chahiye.', 'error');
      return;
    }

    avatarPick.disabled = true;

    try {

      await saveAvatar(await shrinkImage(file));
      window.MC.toast('Profile photo save ho gayi.', 'success');

    } catch (error) {

      window.MC.toast(
        error.message || 'Photo save nahi ho saki.',
        'error'
      );

    } finally {

      avatarPick.disabled = false;

    }

  });

}

if (avatarRemove) {

  avatarRemove.addEventListener('click', async () => {

    try {

      await saveAvatar('');
      window.MC.toast('Profile photo hata di gayi.', 'success');

    } catch (error) {

      window.MC.toast(
        error.message || 'Photo nahi hati.',
        'error'
      );

    }

  });

}


/* =========================
   PIN CODE -> CITY / STATE
   Free India Post lookup. If it fails,
   the customer simply types the fields.
========================= */

const pinCache = new Map();

async function lookupPin(pin) {

  if (pinCache.has(pin)) {
    return pinCache.get(pin);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {

    const response = await fetch(
      'https://api.postalpincode.in/pincode/' + pin,
      { signal: controller.signal }
    );

    const data = await response.json();
    const office = data?.[0]?.PostOffice?.[0];

    const result = office
      ? {
          city: office.District || '',
          state: office.State || ''
        }
      : null;

    pinCache.set(pin, result);

    return result;

  } catch {

    return null;

  } finally {

    clearTimeout(timer);

  }

}


function attachPinAutofill(form) {

  const pinInput = form?.querySelector('[name="pinCode"]');
  const cityInput = form?.querySelector('[name="city"]');
  const stateInput = form?.querySelector('[name="state"]');

  if (!pinInput || !cityInput || !stateInput) {
    return;
  }

  pinInput.addEventListener('input', async () => {

    const pin = pinInput.value.trim();

    if (!isValidPin(pin)) {
      return;
    }

    const place = await lookupPin(pin);

    // Ignore the answer if the PIN changed meanwhile.
    if (!place || pinInput.value.trim() !== pin) {
      return;
    }

    // Never overwrite what the customer already typed.
    if (!cityInput.value.trim()) {
      cityInput.value = place.city;
    }

    if (!stateInput.value.trim()) {
      stateInput.value = place.state;
    }

  });

}


/* =========================
   RESET NEW ADDRESS FORM
========================= */

function resetAddressForm() {

  const form =
    window.MC.$(
      '#addressForm'
    );


  if (!form) {
    return;
  }


  form.reset();


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
      profileUser?.fullName ||
      '';

  }


  if (mobileInput) {

    mobileInput.value =
      profileUser?.mobile ||
      '';

  }

}


/* =========================
   LOAD
========================= */

async function loadProfilePage() {

  const user =
    await window.MC.requireLogin();


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
   ADDRESSES
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

              <article class="saved-address-card">

                <div class="saved-address-top">

                  <div class="saved-address-title">

                    ${window.MC.esc(
                      address.label ||
                      'Address'
                    )}

                  </div>


                  ${
                    address.isDefault

                      ? `
                        <span class="default-badge">
                          DEFAULT
                        </span>
                      `

                      : ''
                  }

                </div>


                <p>

                  <strong>

                    ${window.MC.esc(
                      address.fullName ||
                      ''
                    )}

                  </strong>

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


                <div class="saved-address-actions">

                  <button
                    class="edit-address"
                    type="button"
                    data-id="${window.MC.esc(
                      address._id
                    )}"
                  >
                    Edit Address
                  </button>


                  <button
                    class="delete-address"
                    type="button"
                    data-id="${window.MC.esc(
                      address._id
                    )}"
                  >
                    Delete
                  </button>

                </div>

              </article>

            `
          )
          .join('')

      : `

          <div class="profile-empty">
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
          () => {

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

              openEditAddressDialog(
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

attachPinAutofill(window.MC.$('#addressForm'));

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


      const button =
        event.currentTarget
          .querySelector(
            'button[type="submit"]'
          );


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


      if (
        email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {

        window.MC.toast(
          'Valid email address dalo.',
          'error'
        );

        return;

      }


      profileSaving =
        true;


      if (button) {

        button.disabled =
          true;


        button.textContent =
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


        if (button) {

          button.disabled =
            false;


          button.textContent =
            'Save Profile';

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


      const button =
        form.querySelector(
          'button[type="submit"]'
        );


      const body =
        Object.fromEntries(
          new FormData(
            form
          )
        );


      body.label =
        String(
          body.label || ''
        ).trim();


      body.fullName =
        String(
          body.fullName || ''
        ).trim();


      body.mobile =
        String(
          body.mobile || ''
        ).trim();


      body.addressLine =
        String(
          body.addressLine || ''
        ).trim();


      body.pinCode =
        String(
          body.pinCode || ''
        ).trim();


      body.city =
        String(
          body.city || ''
        ).trim();


      body.state =
        String(
          body.state || ''
        ).trim();


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


      if (button) {

        button.disabled =
          true;


        button.textContent =
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


        if (button) {

          button.disabled =
            false;


          button.textContent =
            'Save Address';

        }

      }

    }
  );

}


/* =========================
   EDIT ADDRESS DIALOG
========================= */

function openEditAddressDialog(
  address
) {

  document
    .querySelector(
      '#editAddressDialog'
    )
    ?.remove();


  const overlay =
    document.createElement(
      'div'
    );


  overlay.id =
    'editAddressDialog';


  overlay.className =
    'profile-dialog-overlay';


  overlay.innerHTML = `

    <form
      class="profile-dialog"
      id="editAddressForm"
    >

      <h2>
        Edit Address
      </h2>


      <div class="address-grid">

        <div class="profile-field">

          <label>
            Label
          </label>

          <input
            class="profile-input"
            name="label"
            value="${window.MC.esc(
              address.label ||
              ''
            )}"
          >

        </div>


        <div class="profile-field">

          <label>
            Full Name
          </label>

          <input
            class="profile-input"
            name="fullName"
            required
            value="${window.MC.esc(
              address.fullName ||
              ''
            )}"
          >

        </div>


        <div class="profile-field">

          <label>
            Mobile
          </label>

          <input
            class="profile-input"
            name="mobile"
            required
            maxlength="10"
            value="${window.MC.esc(
              address.mobile ||
              ''
            )}"
          >

        </div>


        <div class="profile-field">

          <label>
            PIN Code
          </label>

          <input
            class="profile-input"
            name="pinCode"
            required
            maxlength="6"
            value="${window.MC.esc(
              address.pinCode ||
              ''
            )}"
          >

        </div>


        <div class="profile-field full">

          <label>
            Address
          </label>

          <textarea
            class="profile-input profile-textarea"
            name="addressLine"
            required
          >${window.MC.esc(
            address.addressLine ||
            ''
          )}</textarea>

        </div>


        <div class="profile-field">

          <label>
            City
          </label>

          <input
            class="profile-input"
            name="city"
            value="${window.MC.esc(
              address.city ||
              ''
            )}"
          >

        </div>


        <div class="profile-field">

          <label>
            State
          </label>

          <input
            class="profile-input"
            name="state"
            value="${window.MC.esc(
              address.state ||
              ''
            )}"
          >

        </div>

      </div>


      <label class="default-address-check">

        <input
          type="checkbox"
          name="isDefault"
          ${
            address.isDefault
              ? 'checked'
              : ''
          }
        >

        <span>
          Make this my default delivery address
        </span>

      </label>


      <div class="profile-dialog-actions">

        <button
          class="dialog-cancel"
          type="button"
        >
          Cancel
        </button>


        <button
          class="dialog-save"
          type="submit"
        >
          Save Changes
        </button>

      </div>

    </form>

  `;


  document.body.appendChild(
    overlay
  );


  attachPinAutofill(
    overlay.querySelector('#editAddressForm')
  );


  const closeOnEscape = event => {

    if (event.key === 'Escape') {
      overlay.remove();
    }

  };

  document.addEventListener('keydown', closeOnEscape);

  new MutationObserver((_, observer) => {

    if (!document.body.contains(overlay)) {
      document.removeEventListener('keydown', closeOnEscape);
      observer.disconnect();
    }

  }).observe(document.body, { childList: true });


  overlay
    .querySelector(
      '.dialog-cancel'
    )
    ?.addEventListener(
      'click',
      () => {

        overlay.remove();

      }
    );


  overlay.addEventListener(
    'click',
    event => {

      if (
        event.target ===
        overlay
      ) {

        overlay.remove();

      }

    }
  );


  overlay
    .querySelector(
      '#editAddressForm'
    )
    ?.addEventListener(
      'submit',
      async event => {

        event.preventDefault();


        const form =
          event.currentTarget;


        const body =
          Object.fromEntries(
            new FormData(
              form
            )
          );


        body.mobile =
          String(
            body.mobile ||
            ''
          ).trim();


        body.pinCode =
          String(
            body.pinCode ||
            ''
          ).trim();


        body.label =
          String(
            body.label ||
            ''
          ).trim();


        body.fullName =
          String(
            body.fullName ||
            ''
          ).trim();


        body.addressLine =
          String(
            body.addressLine ||
            ''
          ).trim();


        body.city =
          String(
            body.city ||
            ''
          ).trim();


        body.state =
          String(
            body.state ||
            ''
          ).trim();


        body.isDefault =
          Boolean(
            form.querySelector(
              '[name="isDefault"]'
            )?.checked
          );


        if (
          !isValidMobile(
            body.mobile
          )
        ) {

          window.MC.toast(
            'Valid mobile number dalo.',
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
            'Valid PIN Code dalo.',
            'error'
          );

          return;

        }


        const saveButton =
          form.querySelector(
            '.dialog-save'
          );


        if (saveButton) {

          saveButton.disabled =
            true;


          saveButton.textContent =
            'Saving...';

        }


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
                JSON.stringify(
                  body
                )

            }
          );


          overlay.remove();


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


          if (saveButton) {

            saveButton.disabled =
              false;


            saveButton.textContent =
              'Save Changes';

          }

        }

      }
    );

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
        'Delete';

    }

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
    data.user ||
    null;


  if (!profileUser) {

    location.href =
      '/frontend/login.html';

    return;

  }


  fillProfile(
    profileUser
  );

}


/* =========================
   LOGOUT
========================= */

const logoutButton =
  window.MC.$(
    '#profileLogoutBtn'
  );


if (logoutButton) {

  logoutButton.addEventListener(
    'click',
    async () => {

      const confirmed =
        confirm(
          'Kya aap logout karna chahte hain?'
        );


      if (!confirmed) {
        return;
      }


      await window.MC.logoutUser();

    }
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
