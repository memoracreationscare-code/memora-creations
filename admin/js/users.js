const {
  api,
  $,
  $$,
  esc,
  toast
} = window.MC;


async function loadUsers() {

  const admin =
    await window.requireAdmin();

  if (!admin) return;


  const usersBox =
    $('#users');


  try {

    const data =
      await api('/admin/users');


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
              ${esc(user.fullName || '')}
            </b>
          </td>

          <td>
            ${esc(user.mobile || '')}
          </td>

          <td>
            ${esc(user.email || '-')}
          </td>

          <td>
            ${
              user.isActive
                ? 'Active'
                : 'Disabled'
            }
          </td>

          <td>

            <button
              class="btn toggle"
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


    $$('.toggle')
      .forEach(button => {

        button.addEventListener(
          'click',
          async () => {

            try {

              await api(
                '/admin/users/' +
                button.dataset.id +
                '/toggle',
                {
                  method: 'PATCH'
                }
              );


              toast(
                'Customer status updated.',
                'success'
              );


              await loadUsers();


            } catch (error) {

              toast(
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


    toast(
      error.message ||
      'Customers load failed.',
      'error'
    );

  }

}


loadUsers();
