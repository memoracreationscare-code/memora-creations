(() => {

  /* =========================
     HELPERS
  ========================= */

  function formatDateTime(value) {

    if (!value) return '-';

    try {

      return new Date(value)
        .toLocaleString(
          'en-IN',
          {
            dateStyle: 'medium',
            timeStyle: 'short'
          }
        );

    } catch {

      return '-';

    }

  }


  /* =========================
     PASSWORD INPUT POPUP
  ========================= */

  function askNewPassword(user) {

    return new Promise(resolve => {

      const overlay =
        document.createElement('div');


      overlay.style.cssText = `
        position:fixed;
        inset:0;
        background:rgba(0,0,0,.55);
        display:flex;
        align-items:center;
        justify-content:center;
        z-index:99999;
        padding:20px;
      `;


      const popup =
        document.createElement('div');


      popup.style.cssText = `
        width:100%;
        max-width:420px;
        background:#fff;
        border-radius:18px;
        padding:24px;
        box-shadow:0 20px 60px rgba(0,0,0,.25);
      `;


      popup.innerHTML = `

        <div style="
          font-size:22px;
          font-weight:800;
          margin-bottom:8px;
        ">
          🔐 Set New Password
        </div>

        <div style="
          color:#666;
          margin-bottom:18px;
          line-height:1.5;
        ">
          Customer:
          <b>${window.MC.esc(user.fullName || '')}</b>
          <br>
          Mobile:
          <b>${window.MC.esc(user.mobile || '')}</b>
        </div>

        <label style="
          display:block;
          font-weight:700;
          margin-bottom:7px;
        ">
          New Password
        </label>

        <div style="
          display:flex;
          gap:8px;
          margin-bottom:8px;
        ">

          <input
            id="newCustomerPassword"
            type="password"
            placeholder="Minimum 8 characters"
            autocomplete="new-password"
            style="
              flex:1;
              width:100%;
              padding:12px 13px;
              border:1px solid #ccc;
              border-radius:10px;
              font-size:16px;
              outline:none;
            "
          >

          <button
            id="showCustomerPassword"
            type="button"
            style="
              border:1px solid #ccc;
              background:#f8f8f8;
              border-radius:10px;
              padding:0 14px;
              cursor:pointer;
              font-size:18px;
            "
            title="Show / Hide Password"
          >
            👁️
          </button>

        </div>

        <div
          id="passwordError"
          style="
            color:#c62828;
            font-size:13px;
            min-height:20px;
            margin-bottom:8px;
          "
        ></div>

        <div style="
          display:flex;
          gap:10px;
          justify-content:flex-end;
          margin-top:16px;
        ">

          <button
            id="cancelPasswordPopup"
            type="button"
            class="btn secondary"
          >
            Cancel
          </button>

          <button
            id="savePasswordPopup"
            type="button"
            class="btn"
          >
            Save Password
          </button>

        </div>

      `;


      overlay.appendChild(
        popup
      );


      document.body.appendChild(
        overlay
      );


      const input =
        popup.querySelector(
          '#newCustomerPassword'
        );


      const showButton =
        popup.querySelector(
          '#showCustomerPassword'
        );


      const errorBox =
        popup.querySelector(
          '#passwordError'
        );


      const cancelButton =
        popup.querySelector(
          '#cancelPasswordPopup'
        );


      const saveButton =
        popup.querySelector(
          '#savePasswordPopup'
        );


      setTimeout(
        () => input.focus(),
        50
      );


      showButton.addEventListener(
        'click',
        () => {

          input.type =
            input.type === 'password'
              ? 'text'
              : 'password';

        }
      );


      cancelButton.addEventListener(
        'click',
        () => {

          overlay.remove();

          resolve(null);

        }
      );


      saveButton.addEventListener(
        'click',
        () => {

          const password =
            input.value;


          errorBox.textContent =
            '';


          if (
            password.length < 8
          ) {

            errorBox.textContent =
              'Password minimum 8 characters ka hona chahiye.';

            input.focus();

            return;

          }


          if (
            password.length > 100
          ) {

            errorBox.textContent =
              'Password bahut lamba hai.';

            input.focus();

            return;

          }


          overlay.remove();

          resolve(password);

        }
      );


      input.addEventListener(
        'keydown',
        event => {

          if (
            event.key === 'Enter'
          ) {

            saveButton.click();

          }

        }
      );


      overlay.addEventListener(
        'click',
        event => {

          if (
            event.target === overlay
          ) {

            overlay.remove();

            resolve(null);

          }

        }
      );

    });

  }


  /* =========================
     PASSWORD SUCCESS POPUP
  ========================= */

  function showPasswordSuccess(
    user,
    password
  ) {

    return new Promise(resolve => {

      const overlay =
        document.createElement('div');


      overlay.style.cssText = `
        position:fixed;
        inset:0;
        background:rgba(0,0,0,.60);
        display:flex;
        align-items:center;
        justify-content:center;
        z-index:100000;
        padding:20px;
      `;


      const popup =
        document.createElement('div');


      popup.style.cssText = `
        width:100%;
        max-width:440px;
        background:#fff;
        border-radius:20px;
        padding:26px;
        box-shadow:0 20px 65px rgba(0,0,0,.28);
        text-align:center;
      `;


      popup.innerHTML = `

        <div style="
          width:62px;
          height:62px;
          margin:0 auto 14px;
          border-radius:50%;
          display:flex;
          align-items:center;
          justify-content:center;
          background:#e9f7ee;
          font-size:30px;
        ">
          ✅
        </div>

        <div style="
          font-size:23px;
          font-weight:800;
          margin-bottom:8px;
        ">
          Password Changed
        </div>

        <div style="
          color:#666;
          line-height:1.5;
          margin-bottom:20px;
        ">
          ${window.MC.esc(user.fullName || 'Customer')}
          ka new password successfully set ho gaya hai.
        </div>

        <div style="
          text-align:left;
          font-size:13px;
          font-weight:700;
          color:#555;
          margin-bottom:6px;
        ">
          NEW PASSWORD
        </div>

        <div
          id="newPasswordDisplay"
          style="
            background:#f7f4ef;
            border:1px dashed #b79b6c;
            border-radius:12px;
            padding:15px;
            font-size:20px;
            font-weight:800;
            letter-spacing:1px;
            word-break:break-all;
            margin-bottom:12px;
          "
        ></div>

        <button
          id="copyNewPassword"
          type="button"
          class="btn"
          style="
            width:100%;
            margin-bottom:10px;
          "
        >
          📋 Copy Password
        </button>

        <button
          id="closePasswordSuccess"
          type="button"
          class="btn secondary"
          style="
            width:100%;
          "
        >
          Close
        </button>

        <div style="
          color:#a44;
          font-size:12px;
          margin-top:14px;
          line-height:1.5;
        ">
          Ye password sirf is popup me dikhaya ja raha hai.
          Customer ko safely share kar dein.
        </div>

      `;


      overlay.appendChild(
        popup
      );


      document.body.appendChild(
        overlay
      );


      const passwordBox =
        popup.querySelector(
          '#newPasswordDisplay'
        );


      passwordBox.textContent =
        password;


      const copyButton =
        popup.querySelector(
          '#copyNewPassword'
        );


      const closeButton =
        popup.querySelector(
          '#closePasswordSuccess'
        );


      copyButton.addEventListener(
        'click',
        async () => {

          try {

            await navigator.clipboard.writeText(
              password
            );


            copyButton.textContent =
              '✅ Copied';


            setTimeout(
              () => {

                copyButton.textContent =
                  '📋 Copy Password';

              },
              1800
            );


          } catch {

            window.MC.toast(
              'Password copy nahi ho paya.',
              'error'
            );

          }

        }
      );


      function closePopup() {

        overlay.remove();

        resolve();

      }


      closeButton.addEventListener(
        'click',
        closePopup
      );

    });

  }


  /* =========================
     LOAD USERS
  ========================= */

  async function loadUsers() {

    const admin =
      await window.requireAdmin();


    if (!admin) return;


    const usersBox =
      window.MC.$(
        '#users'
      );


    try {

      const data =
        await window.MC.api(
          '/admin/users'
        );


      const users =
        data.users || [];


      if (!users.length) {

        usersBox.innerHTML = `

          <tr>

            <td colspan="5">
              No customers found.
            </td>

          </tr>

        `;

        return;

      }


      usersBox.innerHTML =
        users
          .map(
            user => {

              const resetRequested =
                Boolean(
                  user.passwordResetRequestedAt
                );


              return `

                <tr
                  ${
                    resetRequested
                      ? 'style="background:#fff8f8;"'
                      : ''
                  }
                >

                  <td>

                    <button
                      class="customer-name"
                      type="button"
                      data-id="${user._id}"
                      style="
                        background:none;
                        border:none;
                        padding:0;
                        cursor:pointer;
                        font-weight:700;
                        text-decoration:underline;
                      "
                    >
                      ${window.MC.esc(
                        user.fullName || ''
                      )}
                    </button>

                    ${
                      resetRequested
                        ? `
                          <div style="
                            margin-top:7px;
                            display:inline-block;
                            padding:5px 8px;
                            background:#ffe5e5;
                            color:#b30000;
                            border-radius:7px;
                            font-size:12px;
                            font-weight:800;
                          ">
                            🔴 PASSWORD RESET REQUESTED
                          </div>
                        `
                        : ''
                    }

                  </td>


                  <td>

                    ${window.MC.esc(
                      user.mobile || ''
                    )}

                  </td>


                  <td>

                    ${window.MC.esc(
                      user.email || '-'
                    )}

                    ${
                      resetRequested
                        ? `

                          <div style="
                            margin-top:7px;
                            color:#b30000;
                            font-size:12px;
                            line-height:1.4;
                          ">

                            Request:
                            <b>
                              ${window.MC.esc(
                                formatDateTime(
                                  user.passwordResetRequestedAt
                                )
                              )}
                            </b>

                          </div>

                        `
                        : ''
                    }

                  </td>


                  <td>

                    ${
                      user.isActive
                        ? '✅ Active'
                        : '❌ Disabled'
                    }

                  </td>


                  <td>

                    <div style="
                      display:flex;
                      flex-wrap:wrap;
                      gap:7px;
                    ">

                      <button
                        class="btn set-password"
                        type="button"
                        data-id="${user._id}"
                      >
                        🔐 Set Password
                      </button>


                      <button
                        class="btn toggle-user"
                        type="button"
                        data-id="${user._id}"
                      >

                        ${
                          user.isActive
                            ? 'Disable'
                            : 'Enable'
                        }

                      </button>

                    </div>

                  </td>

                </tr>


                <tr
                  id="orders-${user._id}"
                  style="display:none;"
                >

                  <td colspan="5">

                    <div
                      class="admin-card"
                      style="
                        margin:10px 0;
                      "
                    >

                      <b>
                        Customer Orders
                      </b>

                      <div
                        class="customer-orders"
                        style="
                          margin-top:12px;
                        "
                      >
                        Loading...
                      </div>

                    </div>

                  </td>

                </tr>

              `;

            }
          )
          .join('');


      bindCustomerButtons();

      bindToggleButtons();

      bindPasswordButtons(
        users
      );


    } catch (error) {

      usersBox.innerHTML = `

        <tr>

          <td colspan="5">

            Customers load nahi ho pa rahe hain.

          </td>

        </tr>

      `;


      window.MC.toast(
        error.message ||
        'Customers load failed.',
        'error'
      );

    }

  }


  /* =========================
     SET PASSWORD
  ========================= */

  function bindPasswordButtons(
    users
  ) {

    window.MC
      .$$(
        '.set-password'
      )
      .forEach(
        button => {

          button.addEventListener(
            'click',
            async () => {

              const user =
                users.find(
                  item =>
                    String(
                      item._id
                    ) ===
                    String(
                      button.dataset.id
                    )
                );


              if (!user) {

                window.MC.toast(
                  'Customer nahi mila.',
                  'error'
                );

                return;

              }


              const password =
                await askNewPassword(
                  user
                );


              if (!password) {

                return;

              }


              const originalText =
                button.textContent;


              button.disabled =
                true;

              button.textContent =
                'Saving...';


              try {

                await window.MC.api(
                  '/admin/users/' +
                  user._id +
                  '/password',
                  {

                    method:
                      'PATCH',

                    body:
                      JSON.stringify({
                        password
                      })

                  }
                );


                window.MC.toast(
                  'Customer password updated.',
                  'success'
                );


                await showPasswordSuccess(
                  user,
                  password
                );


                await loadUsers();


              } catch (error) {

                window.MC.toast(
                  error.message ||
                  'Password update failed.',
                  'error'
                );


                button.disabled =
                  false;

                button.textContent =
                  originalText;

              }

            }
          );

        }
      );

  }


  /* =========================
     CUSTOMER ORDERS
  ========================= */

  function bindCustomerButtons() {

    window.MC
      .$$(
        '.customer-name'
      )
      .forEach(
        button => {

          button.addEventListener(
            'click',
            async () => {

              const userId =
                button.dataset.id;


              const row =
                document.querySelector(
                  '#orders-' +
                  userId
                );


              if (!row) return;


              if (
                row.style.display ===
                'table-row'
              ) {

                row.style.display =
                  'none';

                return;

              }


              row.style.display =
                'table-row';


              const box =
                row.querySelector(
                  '.customer-orders'
                );


              box.innerHTML =
                'Loading orders...';


              try {

                const data =
                  await window.MC.api(
                    '/admin/users/' +
                    userId +
                    '/orders'
                  );


                const orders =
                  data.orders || [];


                if (
                  !orders.length
                ) {

                  box.innerHTML = `

                    <p>

                      Is customer ne abhi tak
                      koi order nahi kiya hai.

                    </p>

                  `;

                  return;

                }


                box.innerHTML =
                  orders
                    .map(
                      order => `

                        <div
                          class="admin-card"
                          style="
                            margin:10px 0;
                            padding:14px;
                          "
                        >

                          <b>

                            Order ID:

                            ${window.MC.esc(
                              order.orderId || ''
                            )}

                          </b>

                          <br><br>

                          Date:

                          ${
                            order.createdAt
                              ? new Date(
                                  order.createdAt
                                )
                                  .toLocaleString(
                                    'en-IN'
                                  )
                              : '-'
                          }

                          <br>

                          Total:

                          <b>

                            ${window.MC.money(
                              order.grandTotal
                            )}

                          </b>

                          <br>

                          Payment:

                          ${window.MC.esc(
                            order.paymentMethod || ''
                          )}

                          <br>

                          Payment Status:

                          ${window.MC.esc(
                            order.paymentStatus || ''
                          )}

                          <br>

                          Order Status:

                          <b>

                            ${window.MC.esc(
                              order.orderStatus || ''
                            )}

                          </b>

                        </div>

                      `
                    )
                    .join('');


              } catch (error) {

                box.innerHTML = `

                  <div
                    class="message error"
                  >

                    Orders load nahi ho pa rahe hain.

                  </div>

                `;


                window.MC.toast(
                  error.message ||
                  'Customer orders load failed.',
                  'error'
                );

              }

            }
          );

        }
      );

  }


  /* =========================
     ENABLE / DISABLE USER
  ========================= */

  function bindToggleButtons() {

    window.MC
      .$$(
        '.toggle-user'
      )
      .forEach(
        button => {

          button.addEventListener(
            'click',
            async () => {

              try {

                button.disabled =
                  true;


                await window.MC.api(
                  '/admin/users/' +
                  button.dataset.id +
                  '/toggle',
                  {
                    method:
                      'PATCH'
                  }
                );


                window.MC.toast(
                  'Customer status updated.',
                  'success'
                );


                await loadUsers();


              } catch (error) {

                button.disabled =
                  false;


                window.MC.toast(
                  error.message ||
                  'Customer update failed.',
                  'error'
                );

              }

            }
          );

        }
      );

  }


  /* =========================
     START
  ========================= */

  loadUsers();

})();
