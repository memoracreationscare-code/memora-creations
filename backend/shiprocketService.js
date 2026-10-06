const SHIPROCKET_BASE =
  'https://apiv2.shiprocket.in/v1/external';

let cachedToken = null;
let tokenExpiresAt = 0;


function configured() {
  return Boolean(
    process.env.SHIPROCKET_EMAIL &&
    process.env.SHIPROCKET_PASSWORD
  );
}


async function getShiprocketToken() {

  if (!configured()) {
    throw new Error(
      'Shiprocket credentials are not configured.'
    );
  }

  if (
    cachedToken &&
    Date.now() < tokenExpiresAt
  ) {
    return cachedToken;
  }


  const response = await fetch(
    `${SHIPROCKET_BASE}/auth/login`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: process.env.SHIPROCKET_EMAIL,
        password: process.env.SHIPROCKET_PASSWORD
      })
    }
  );


  const data = await response.json();


  if (!response.ok || !data.token) {

    console.error(
      'Shiprocket auth error:',
      data
    );

    throw new Error(
      data?.message ||
      'Shiprocket authentication failed.'
    );
  }


  cachedToken = data.token;

  tokenExpiresAt =
    Date.now() +
    (8 * 60 * 60 * 1000);

  return cachedToken;
}


async function shiprocketRequest(
  path,
  options = {}
) {

  const token =
    await getShiprocketToken();


  const response =
    await fetch(
      `${SHIPROCKET_BASE}${path}`,
      {
        ...options,

        headers: {
          'Content-Type':
            'application/json',

          'Authorization':
            `Bearer ${token}`,

          ...(options.headers || {})
        }
      }
    );


  let data = {};

  try {
    data = await response.json();
  } catch {}


  if (!response.ok) {

    console.error(
      'Shiprocket API error:',
      response.status,
      data
    );

    throw new Error(
      data?.message ||
      'Shiprocket API request failed.'
    );
  }


  return data;
}


async function getWalletBalance() {

  return shiprocketRequest(
    '/account/details/wallet-balance'
  );

}


module.exports = {
  configured,
  getShiprocketToken,
  shiprocketRequest,
  getWalletBalance
};
