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


          <tr
            id="orders-${user._id}"
            style="display:none;"
          >

            <td colspan="5">

              <div
                class="admin-card"
                style="margin:10px 0;"
              >

                <b>
                  Customer Orders
                </b>

                <div
                  class="customer-orders"
                  style="margin-top:12px;"
                >
                  Loading...
                </div>

              </div>

            </td>

          </tr>

        `).join('');


      bindCustomerButtons();
      bindToggleButtons();


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
     CUSTOMER ORDERS
  ========================= */

  function bindCustomerButtons() {

    window.MC
      .$$('.customer-name')
      .forEach(button => {

        button.addEventListener(
          'click',
          async () => {

            const userId =
              button.dataset.id;


            const row =
              document.querySelector(
                '#orders-' + userId
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


              if (!orders.length) {

                box.innerHTML = `
                  <p>
                    Is customer ne abhi tak
                    koi order nahi kiya hai.
                  </p>
                `;

                return;
              }


              box.innerHTML =
                orders.map(order => `

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
                          ).toLocaleString(
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

                `).join('');


            } catch (error) {

              box.innerHTML = `
                <div class="message error">
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

      });

  }


  /* =========================
     ENABLE / DISABLE USER
  ========================= */

  function bindToggleButtons() {

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

  }


  loadUsers();

})();
