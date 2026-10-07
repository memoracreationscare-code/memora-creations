(() => {

  async function loadUsers() {

    const admin =
      await window.requireAdmin();

    if (!admin) return;


    const usersBox =
      window.MC.$('#users');


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
        users.map(user => `

          <tr>

            <td>
              <b>
                ${window.MC.esc(
                  user.fullName || ''
                )}
              </b>
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
            </td>

            <td>
              ${
                user.isActive
                  ? '✅ Active'
                  : '❌ Disabled'
              }
            </td>

            <td>

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

            </td>

          </tr>

        `).join('');


      window.MC
        .$$('.toggle-user')
        .forEach(button => {

          button.addEventListener(
            'click',
            async () => {

              try {

                await window.MC.api(
                  '/admin/users/' +
                  button.dataset.id +
                  '/toggle',
                  {
                    method: 'PATCH'
                  }
                );


                window.MC.toast(
                  'Customer status updated.',
                  'success'
                );


                await loadUsers();


              } catch (error) {

                window.MC.toast(
                  error.message ||
                  'Customer update failed.',
                  'error'
                );

              }

            }
          );

        });


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


  loadUsers();

})();
